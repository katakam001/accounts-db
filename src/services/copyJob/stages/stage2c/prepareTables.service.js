const CacheTracker = require("../../utils/cacheTracker");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const { getDb } = require("../../../../utils/getDb");
const Constants = require("../../../../constants/constantsUtils");
const stageHelperService = require("../common/stageHelpers.service");

module.exports = async function prepareStage2c(jobId) {
  const db = getDb();

  try {
    const CopyJob = db.copyJob;
    const CopyJobTable = db.copyJobTable;
    const CopyJobChunkTableMap = db.copyJobChunkTableMap;

    // Step 1: Fetch job metadata
    const job = await CopyJob.findByPk(jobId);
    if (!job) throw new Error(`CopyJob ${jobId} not found`);

    const stageConfig = copyJobConfig.stages.data.stage2c;
    const PAGE_SIZE = 1000;
    let offset = 0;
    let chunkIndex = 0;

    // 🔹 Initialize cache tables once at start
    const tables = await CopyJobTable.findAll({
      where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE2C },
    });
    for (const table of tables) {
      CacheTracker.initTable(jobId, table.table_name, 0);
    }

    // Step 2: Paginate in chunks
    while (true) {
      const transaction = await db.sequelize.transaction();
      try {
        // Cash Entries
        const cashEntries = await db.sequelize.query(
          `SELECT * FROM cash_entries
           WHERE user_id = :uid AND financial_year = :fy
             AND narration NOT LIKE 'Aggregated %'
             AND narration NOT LIKE 'CASH entry for %'
           ORDER BY id
           LIMIT :limit OFFSET :offset`,
          { replacements: { uid: job.source_user_id, fy: job.financial_year, limit: PAGE_SIZE, offset }, type: db.Sequelize.QueryTypes.SELECT, transaction }
        );

        // Cash Batch Entries
        const cashBatch = await db.sequelize.query(
          `SELECT * FROM cash_entries_batch
           WHERE user_id = :uid AND financial_year = :fy
           ORDER BY id
           LIMIT :limit OFFSET :offset`,
          { replacements: { uid: job.source_user_id, fy: job.financial_year, limit: PAGE_SIZE, offset }, type: db.Sequelize.QueryTypes.SELECT, transaction }
        );

        // Production Entries (roots + children via temp table)
        await db.sequelize.query(`CREATE TEMP TABLE parent_ids (id BIGINT)`, { transaction });

        const [_, insertedCount] = await db.sequelize.query(
          `INSERT INTO parent_ids (id)
           SELECT id
           FROM production_entries
           WHERE user_id = :uid AND financial_year = :fy
             AND production_entry_id IS NULL
           ORDER BY id
           LIMIT :limit OFFSET :offset`,
          { replacements: { uid: job.source_user_id, fy: job.financial_year, limit: PAGE_SIZE, offset }, type: db.Sequelize.QueryTypes.INSERT, transaction }
        );

        let productionEntries = [];
        if (insertedCount > 0) {
          productionEntries = await db.sequelize.query(
            `SELECT pe.* 
             FROM production_entries pe
             JOIN parent_ids p ON pe.id = p.id OR pe.production_entry_id = p.id
             WHERE pe.user_id = :uid AND pe.financial_year = :fy`,
            { replacements: { uid: job.source_user_id, fy: job.financial_year }, type: db.Sequelize.QueryTypes.SELECT, transaction }
          );
        }

        await db.sequelize.query(`DROP TABLE parent_ids`, { transaction });

        // Stop if all three are empty
        if (cashEntries.length === 0 && cashBatch.length === 0 && productionEntries.length === 0) {
          await transaction.rollback();
          break;
        }

        // Step 3: Build bundle
        const bundle = {
          metadata: {
            independent: stageConfig.tables || [],
            order: stageConfig.order,
            userScoped: stageConfig.userScoped,
            groups: stageConfig.groups || []
          },
          tables: {
            cash_entries: cashEntries.map(({ createdAt, updatedAt, ...rest }) => rest),
            cash_entries_batch: cashBatch.map(({ createdAt, updatedAt, ...rest }) => rest),
            production_entries: productionEntries.map(({ createdAt, updatedAt, ...rest }) => rest)
          }
        };

        // Step 4: Upload bundle to S3
        const s3Key = await stageHelperService.uploadStageBundle(
          job, jobId, Constants.STAGE_IDS.STAGE2C, bundle, transaction, db, chunkIndex
        );

        // Step 5: Insert chunk metadata + update table totals
        for (const [tableName, rows] of Object.entries(bundle.tables)) {

          const tableMeta = await CopyJobTable.findOne({
            where: { job_id: job.id, table_name: tableName, stage: Constants.STAGE_IDS.STAGE2C },
            transaction
          });
          if (!tableMeta) continue;

          const chunkRow = await CopyJobChunkTableMap.create({
            copy_job_table_id: tableMeta.id,
            chunk_index: chunkIndex,
            s3_key: s3Key,
            row_count: rows.length,
            processed_count: 0,
            status: rows.length === 0 ? Constants.JOB_STATUS.SUCCESS : Constants.JOB_STATUS.IN_PROGRESS
          }, { transaction });

          await CopyJobTable.update(
            {
              total_count: db.Sequelize.literal(`COALESCE(total_count,0) + ${rows.length}`),
              status: rows.length === 0 ? Constants.JOB_STATUS.SUCCESS : Constants.JOB_STATUS.IN_PROGRESS
            },
            { where: { id: tableMeta.id }, transaction }
          );

          CacheTracker.setChunkMeta(jobId, tableName, Constants.STAGE_IDS.STAGE2C, chunkRow.s3_key, chunkRow.chunk_index, chunkRow.row_count);
          CacheTracker.incrementChunkTotal(jobId, tableName, Constants.STAGE_IDS.STAGE2C);
          // ✅ bulk increment totals in cache
          if (rows.length > 0) {
            CacheTracker.incrementBy(jobId, tableName, "total", rows.length);
          }
        }

        await transaction.commit();
        offset += PAGE_SIZE;
        chunkIndex++;
      } catch (err) {
        await transaction.rollback();
        console.error(`❌ Stage2c chunk ${chunkIndex} failed for Job ${jobId}:`, err.message);
        throw err;
      }
    }

    if (chunkIndex === 0) {
      const transaction = await db.sequelize.transaction();
      try {
        const emptyBundle = {
          metadata: {
            independent: stageConfig.tables || [],
            order: stageConfig.order,
            userScoped: stageConfig.userScoped,
            groups: stageConfig.groups || []
          },
          tables: {
            cash_entries: [],
            cash_entries_batch: [],
            production_entries: []
          }
        };

        const s3Key = await stageHelperService.uploadStageBundle(
          job, jobId, Constants.STAGE_IDS.STAGE2C, emptyBundle, transaction, db, 0
        );

        for (const tableName of Object.keys(emptyBundle.tables)) {
          const tableMeta = await CopyJobTable.findOne({
            where: { job_id: job.id, table_name: tableName, stage: Constants.STAGE_IDS.STAGE2C },
            transaction
          });
          if (!tableMeta) continue;

          await CopyJobChunkTableMap.create({
            copy_job_table_id: tableMeta.id,
            chunk_index: 0,
            s3_key: s3Key,
            row_count: 0,
            processed_count: 0,
            status: Constants.JOB_STATUS.SUCCESS
          }, { transaction });

          await CopyJobTable.update(
            { total_count: 0, status: Constants.JOB_STATUS.SUCCESS },
            { where: { id: tableMeta.id }, transaction }
          );
        }

        await transaction.commit();
        console.log(`✅ Stage2c emitted empty bundle for Job ${jobId}`);
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    }

    // Step 6: Update job status (outside loop, once all chunks prepared)
    await CopyJob.update(
      { status: Constants.JOB_STATUS.IN_PROGRESS, current_stage: Constants.STAGE_IDS.STAGE2C, error_message: null },
      { where: { id: jobId } }
    );

    console.log(`🚀 Stage2c preparation complete for Job ${jobId}`);
    // Trigger monitoring
    try {
      const monitorService = require("../../../../services/monitor.service");
      monitorService.startMonitoring();
    } catch (err) {
      console.error(`❌ Monitoring failed for Job ${jobId}:`, err.message);
      await db.copyJob.update(
        { status: Constants.JOB_STATUS.FAILURE, error_message: err.message },
        { where: { id: jobId } }
      );
    }
    return { jobId };
  } catch (err) {
    await db.copyJob.update(
      { status: Constants.JOB_STATUS.FAILURE, current_stage: Constants.STAGE_IDS.STAGE2C, error_message: err.message },
      { where: { id: jobId } }
    );
    throw err;
  }
};
