const CacheTracker = require("../../utils/cacheTracker");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const { getDb } = require("../../../../utils/getDb");
const Constants = require("../../../../constants/constantsUtils");
const stageHelperService = require("../common/stageHelpers.service");

module.exports = async function prepareStage2a(jobId) {
  const db = getDb();
  const transaction = await db.sequelize.transaction();

  try {
    const CopyJob = db.copyJob;
    const CopyJobTable = db.copyJobTable;
    const CopyJobChunkTableMap = db.copyJobChunkTableMap;

    // Step 1: Fetch job metadata
    const job = await CopyJob.findByPk(jobId, { transaction });
    if (!job) throw new Error(`CopyJob ${jobId} not found`);

    const stageConfig = copyJobConfig.stages.data.stage2a;

    const bundle = {
      metadata: {
        groups: stageConfig.groups || [],
        order: stageConfig.order,
        userScoped: stageConfig.userScoped
      },
      tables: {}
    };

    // Step 2: Pull data per table
    const tables = await CopyJobTable.findAll({
      where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE2A },
      order: [["order_index", "ASC"], ["sub_order_index", "ASC"]],
      transaction
    });

    for (const table of tables) {
      let rows;

      if (table.table_name === "journal_entries") {
        // ✅ Only type = 0 journal entries
        rows = await db.sequelize.query(
          `SELECT * FROM journal_entries 
           WHERE user_id = :uid AND financial_year = :fy AND type = 0`,
          {
            replacements: { uid: job.source_user_id, fy: job.financial_year },
            type: db.Sequelize.QueryTypes.SELECT,
            transaction
          }
        );
      } else if (table.table_name === "journal_items") {
        // ✅ journal_items scoped via parent journal_entries
        rows = await db.sequelize.query(
          `SELECT ji.* 
           FROM journal_items ji
           JOIN journal_entries je ON ji.journal_id = je.id
           WHERE je.user_id = :uid AND je.financial_year = :fy AND je.type = 0`,
          {
            replacements: { uid: job.source_user_id, fy: job.financial_year },
            type: db.Sequelize.QueryTypes.SELECT,
            transaction
          }
        );
      }

      const filteredRows = rows.map(({ createdAt, updatedAt, ...rest }) => rest);
      bundle.tables[table.table_name] = filteredRows;

      if (filteredRows.length > 0) {
        CacheTracker.initTable(jobId, table.table_name, filteredRows.length);
      }

    }

    // Step 5: Upload bundle to S3
    const s3Key = await stageHelperService.uploadStageBundle(
      job, jobId, Constants.STAGE_IDS.STAGE2A, bundle, transaction, db, 0
    );

    // Step 6: Insert chunk metadata + update table totals
    for (const [tableName, rows] of Object.entries(bundle.tables)) {
      const tableMeta = await CopyJobTable.findOne({
        where: { job_id: job.id, stage: Constants.STAGE_IDS.STAGE2A, table_name: tableName },
        transaction
      });
      if (!tableMeta) continue;

      const chunkRow = await CopyJobChunkTableMap.create({
        copy_job_table_id: tableMeta.id,
        chunk_index: 0,
        s3_key: s3Key,
        row_count: rows.length,
        processed_count: 0,
        status: rows.length === 0 ? Constants.JOB_STATUS.SUCCESS : Constants.JOB_STATUS.IN_PROGRESS
      }, { transaction });

      await CopyJobTable.update(
        {
          total_count: rows.length,
          status: rows.length === 0 ? Constants.JOB_STATUS.SUCCESS : Constants.JOB_STATUS.IN_PROGRESS
        },
        { where: { id: tableMeta.id }, transaction }
      );

      CacheTracker.setChunkMeta(jobId, tableName, Constants.STAGE_IDS.STAGE2A, chunkRow.s3_key, chunkRow.chunk_index, chunkRow.row_count);
      CacheTracker.incrementChunkTotal(jobId, tableName, Constants.STAGE_IDS.STAGE2A);
    }

    // Step 5: Update job status
    await CopyJob.update(
      { status: Constants.JOB_STATUS.IN_PROGRESS, current_stage: Constants.STAGE_IDS.STAGE2A, error_message: null },
      { where: { id: jobId }, transaction }
    );

    await transaction.commit();
    console.log(`🚀 Stage2a preparation complete for Job ${jobId}`);

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

    return { jobId, s3Key };
  } catch (err) {
    await transaction.rollback();
    await db.copyJob.update(
      { status: Constants.JOB_STATUS.FAILURE, current_stage: Constants.STAGE_IDS.STAGE2A, error_message: err.message },
      { where: { id: jobId } }
    );
    throw err;
  }
};
