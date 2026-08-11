const CacheTracker = require("../../utils/cacheTracker");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const { getDb } = require("../../../../utils/getDb");
const Constants = require("../../../../constants/constantsUtils");
const stageHelperService = require("../common/stageHelpers.service");

module.exports = async function prepareStage2d(jobId) {
  const db = getDb();

  try {
    const CopyJob = db.copyJob;
    const CopyJobTable = db.copyJobTable;
    const CopyJobChunkTableMap = db.copyJobChunkTableMap;

    // Step 1: Fetch current job metadata
    const job = await CopyJob.findByPk(jobId);
    if (!job) throw new Error(`CopyJob ${jobId} not found`);

    // 🔹 Find latest previous job for same target user + financial year
    const latestPrevJob = await CopyJob.findOne({
      where: {
        target_user_id: job.target_user_id,
        financial_year: job.financial_year,
        id: { [db.Sequelize.Op.ne]: jobId }   // exclude current job
      },
      order: [["createdAt", "DESC"]]
    });

    const stageConfig = copyJobConfig.stages.data.stage2d;
    const PAGE_SIZE = 1000;
    let offset = 0;
    let chunkIndex = 0;

    // Initialize cache tables
    const tables = await CopyJobTable.findAll({
      where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE2D },
    });
    for (const table of tables) {
      CacheTracker.initTable(jobId, table.table_name, 0);
    }

    // Step 2: Paginate summaries in chunks
    while (true) {
      const transaction = await db.sequelize.transaction();

      try {
        await db.sequelize.query(`CREATE TEMP TABLE parent_summaries (id BIGINT)`, { transaction });

        const [_, insertedCount] = await db.sequelize.query(
          `WITH date_batch AS (
             SELECT DISTINCT entry_date
             FROM daily_cash_entry_summary
             WHERE user_id = :uid AND financial_year = :fy
             ORDER BY entry_date
             LIMIT :limit OFFSET :offset
           )
           INSERT INTO parent_summaries (id)
           SELECT id
           FROM daily_cash_entry_summary s
           WHERE s.user_id = :uid
             AND s.financial_year = :fy
             AND s.entry_date IN (SELECT entry_date FROM date_batch)`,
          {
            replacements: { uid: job.source_user_id, fy: job.financial_year, limit: PAGE_SIZE, offset },
            type: db.Sequelize.QueryTypes.INSERT,
            transaction
          }
        );

        if (insertedCount === 0) {
          await db.sequelize.query(`DROP TABLE parent_summaries`, { transaction });
          await transaction.rollback();
          break;
        }

        const sales = await db.sequelize.query(
          `SELECT cs.*
           FROM cash_sale_entries cs
           WHERE cs.id IN (
             SELECT DISTINCT l.cash_sale_entry_id
             FROM cash_sale_entry_links l
             JOIN parent_summaries p ON l.summary_id = p.id
           )`,
          { type: db.Sequelize.QueryTypes.SELECT, transaction }
        );

        const fields = await db.sequelize.query(
          `SELECT f.*
           FROM cash_entry_fields f
           WHERE f.cash_sale_entry_id IN (
             SELECT DISTINCT l.cash_sale_entry_id
             FROM cash_sale_entry_links l
             JOIN parent_summaries p ON l.summary_id = p.id
           )`,
          { type: db.Sequelize.QueryTypes.SELECT, transaction }
        );

        // Step 4: Build bundle (only sales + fields, plus latestPrevJobId)
        const bundle = {
          metadata: {
            groups: stageConfig.groups || [],
            order: stageConfig.order,
            userScoped: stageConfig.userScoped,
            latestJobId: latestPrevJob ? latestPrevJob.id : null   // ✅ correct previous jobId
          },
          tables: {
            cash_sale_entries: sales.map(({ createdAt, updatedAt, ...rest }) => rest),
            cash_entry_fields: fields.map(({ createdAt, updatedAt, ...rest }) => rest)
          }
        };

        // Step 5: Upload bundle to S3
        const s3Key = await stageHelperService.uploadStageBundle(
          job, jobId, Constants.STAGE_IDS.STAGE2D, bundle, transaction, db, chunkIndex
        );

        // Step 6: Insert chunk metadata + update table totals
        for (const [tableName, rows] of Object.entries(bundle.tables)) {
          const tableMeta = await CopyJobTable.findOne({
            where: { job_id: job.id, table_name: tableName, stage: Constants.STAGE_IDS.STAGE2D },
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

          CacheTracker.setChunkMeta(jobId, tableName, Constants.STAGE_IDS.STAGE2D, chunkRow.s3_key, chunkRow.chunk_index, chunkRow.row_count);
          CacheTracker.incrementChunkTotal(jobId, tableName, Constants.STAGE_IDS.STAGE2D);

          if (rows.length > 0) {
            CacheTracker.incrementBy(jobId, tableName, "total", rows.length);
          }
        }

        await db.sequelize.query(`DROP TABLE parent_summaries`, { transaction });
        await transaction.commit();

        offset += PAGE_SIZE;
        chunkIndex++;
      } catch (err) {
        await transaction.rollback();
        console.error(`❌ Stage2d chunk ${chunkIndex} failed for Job ${jobId}:`, err.message);
        throw err;
      }
    }

    // Step 7: Update job status
    await CopyJob.update(
      { status: Constants.JOB_STATUS.IN_PROGRESS, current_stage: Constants.STAGE_IDS.STAGE2D, error_message: null },
      { where: { id: jobId } }
    );

    console.log(`🚀 Stage2d preparation complete for Job ${jobId}`);
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
      { status: Constants.JOB_STATUS.FAILURE, current_stage: Constants.STAGE_IDS.STAGE2D, error_message: err.message },
      { where: { id: jobId } }
    );
    throw err;
  }
};
