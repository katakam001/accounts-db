const CacheTracker = require("../../utils/cacheTracker");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const { getDb } = require("../../../../utils/getDb");
const Constants = require("../../../../constants/constantsUtils");
const stageHelperService = require("../common/stageHelpers.service");

module.exports = async function prepareStage2b(jobId) {
  const db = getDb();

  try {
    const CopyJob = db.copyJob;
    const CopyJobTable = db.copyJobTable;
    const CopyJobChunkTableMap = db.copyJobChunkTableMap;

    // Step 1: Fetch job metadata
    const job = await CopyJob.findByPk(jobId);
    if (!job) throw new Error(`CopyJob ${jobId} not found`);

    const stageConfig = copyJobConfig.stages.data.stage2b;
    const PAGE_SIZE = 1000;
    let offset = 0;
    let chunkIndex = 0;

    // 🔹 Initialize cache tables once at start
    const tables = await CopyJobTable.findAll({
      where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE2B },
    });
    for (const table of tables) {
      CacheTracker.initTable(jobId, table.table_name, 0);
    }

    // Step 2: Paginate journal_entries in chunks
    while (true) {
      const transaction = await db.sequelize.transaction();

      try {
        // Create temp table for parent IDs
        await db.sequelize.query(`CREATE TEMP TABLE parent_ids (id BIGINT)`, { transaction });

        // Insert parent batch
        const [_, insertedCount] = await db.sequelize.query(
          `INSERT INTO parent_ids (id)
           SELECT id
           FROM journal_entries
           WHERE user_id = :uid
             AND financial_year = :fy
             AND type BETWEEN 1 AND 6
           ORDER BY id
           LIMIT :limit OFFSET :offset`,
          {
            replacements: { uid: job.source_user_id, fy: job.financial_year, limit: PAGE_SIZE, offset },
            type: db.Sequelize.QueryTypes.INSERT,
            transaction
          }
        );

        if (insertedCount === 0) {
          await db.sequelize.query(`DROP TABLE parent_ids`, { transaction });
          await transaction.rollback();
          break; // no more rows
        }

        // Step 3: Fetch parents + children
        const journalEntries = await db.sequelize.query(
          `SELECT je.* FROM journal_entries je JOIN parent_ids p ON je.id = p.id`,
          { type: db.Sequelize.QueryTypes.SELECT, transaction }
        );
        const journalItems = await db.sequelize.query(
          `SELECT ji.* FROM journal_items ji JOIN parent_ids p ON ji.journal_id = p.id`,
          { type: db.Sequelize.QueryTypes.SELECT, transaction }
        );
        const entries = await db.sequelize.query(
          `SELECT e.* FROM entries e JOIN parent_ids p ON e.journal_id = p.id`,
          { type: db.Sequelize.QueryTypes.SELECT, transaction }
        );
        const entryFields = await db.sequelize.query(
          `SELECT ef.* FROM entry_fields ef
           JOIN entries e ON ef.entry_id = e.id
           JOIN parent_ids p ON e.journal_id = p.id`,
          { type: db.Sequelize.QueryTypes.SELECT, transaction }
        );

        // Step 4: Build bundle
        const bundle = {
          metadata: {
            groups: stageConfig.groups || [],
            order: stageConfig.order,
            userScoped: stageConfig.userScoped
          },
          tables: {
            journal_entries: journalEntries.map(({ createdAt, updatedAt, ...rest }) => rest),
            journal_items: journalItems.map(({ createdAt, updatedAt, ...rest }) => rest),
            entries: entries.map(({ createdAt, updatedAt, ...rest }) => rest),
            entry_fields: entryFields.map(({ createdAt, updatedAt, ...rest }) => rest)
          }
        };

        // Step 5: Upload bundle to S3
        const s3Key = await stageHelperService.uploadStageBundle(
          job, jobId, Constants.STAGE_IDS.STAGE2B, bundle, transaction, db, chunkIndex
        );

        // Step 6: Insert chunk metadata + update table totals
        for (const [tableName, rows] of Object.entries(bundle.tables)) {
          const tableMeta = await CopyJobTable.findOne({
            where: { job_id: job.id, table_name: tableName, stage: Constants.STAGE_IDS.STAGE2B },
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

          CacheTracker.setChunkMeta(jobId, tableName, Constants.STAGE_IDS.STAGE2B, chunkRow.s3_key, chunkRow.chunk_index, chunkRow.row_count);
          CacheTracker.incrementChunkTotal(jobId, tableName, Constants.STAGE_IDS.STAGE2B);

          // ✅ bulk increment totals in cache
          if (rows.length > 0) {
            CacheTracker.incrementBy(jobId, tableName, "total", rows.length);
          }
        }

        // Cleanup temp table
        await db.sequelize.query(`DROP TABLE parent_ids`, { transaction });

        // 🔹 Commit per chunk
        await transaction.commit();

        offset += PAGE_SIZE;
        chunkIndex++;
      } catch (err) {
        await transaction.rollback();
        console.error(`❌ Stage2b chunk ${chunkIndex} failed for Job ${jobId}:`, err.message);
        throw err;
      }
    }

    if (chunkIndex === 0) {
      const transaction = await db.sequelize.transaction();
      try {
        const emptyBundle = {
          metadata: {
            groups: stageConfig.groups || [],
            order: stageConfig.order,
            userScoped: stageConfig.userScoped
          },
          tables: {
            journal_entries: [],
            journal_items: [],
            entries: [],
            entry_fields: []
          }
        };

        const s3Key = await stageHelperService.uploadStageBundle(
          job, jobId, Constants.STAGE_IDS.STAGE2B, emptyBundle, transaction, db, 0
        );

        for (const tableName of Object.keys(emptyBundle.tables)) {
          const tableMeta = await CopyJobTable.findOne({
            where: { job_id: job.id, table_name: tableName, stage: Constants.STAGE_IDS.STAGE2B },
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
        console.log(`✅ Stage2b emitted empty bundle for Job ${jobId}`);
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    }

    // Step 7: Update job status (outside loop, once all chunks prepared)
    await CopyJob.update(
      { status: Constants.JOB_STATUS.IN_PROGRESS, current_stage: Constants.STAGE_IDS.STAGE2B, error_message: null },
      { where: { id: jobId } }
    );

    console.log(`🚀 Stage2b preparation complete for Job ${jobId}`);

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
      { status: Constants.JOB_STATUS.FAILURE, current_stage: Constants.STAGE_IDS.STAGE2B, error_message: err.message },
      { where: { id: jobId } }
    );
    throw err;
  }
};
