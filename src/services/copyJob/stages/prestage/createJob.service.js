const copyJobConfig = require("../../../../constants/copyJobMeta");
const Constants = require("../../../../constants/constantsUtils"); // ✅ import

/**
 * Service to initialize a new CopyJob and its tables
 * @param {Object} payload - job creation payload
 * @param {Object} db - Sequelize db instance
 * @param {Object} transaction - Sequelize transaction
 * @returns {number} jobId
 */
module.exports = async function createJobService(adminId, payload, db, transaction) {

  const CopyJob = db.copyJob;
  const CopyJobTable = db.copyJobTable;

  const financialYear = deriveFinancialYear(payload.from_date, payload.to_date);

  // Step 1: Create the job record
  const job = await CopyJob.create({
    admin_id: adminId,
    source_user_id: payload.source_user_id,
    target_user_id: payload.target_user_id,
    from_date: payload.from_date,
    to_date: payload.to_date,
    financial_year: financialYear,   // ✅ new field
    status: Constants.JOB_STATUS.PENDING,
    current_stage: Constants.STAGE_IDS.PRESTAGE
  }, { transaction });

  // Step 2: Collect stage configs
  const stageConfigs = [
    copyJobConfig.stages.configuration.stage1a,
    copyJobConfig.stages.configuration.stage1b,
    copyJobConfig.stages.configuration.stage1c,
    copyJobConfig.stages.data.stage2a,
    copyJobConfig.stages.data.stage2b,
    copyJobConfig.stages.data.stage2c,
    copyJobConfig.stages.data.stage2d,
    copyJobConfig.stages.finalize.finalize
  ];

  const jobTables = [];

  stageConfigs.forEach(cfg => {
    if (!cfg || !cfg.order) return;

    cfg.order.forEach((entry, idx) => {
      const group = cfg.groups?.find(g => g.name === entry);

      if (group) {
        group.order.forEach((tableName, gIdx) => {
          jobTables.push({
            job_id: job.id,
            table_name: tableName,
            stage: cfg.stage,
            group_name: group.name,
            order_index: idx,
            sub_order_index: gIdx,
            status: Constants.JOB_STATUS.PENDING,
            total_count: 0,
            processed_count: 0,
            inserted_count: 0,
            skipped_count: 0
          });
        });
      } else {
        jobTables.push({
          job_id: job.id,
          table_name: entry,
          stage: cfg.stage,
          order_index: idx,
          sub_order_index: null,
          status: Constants.JOB_STATUS.PENDING,
          total_count: 0,
          processed_count: 0,
          inserted_count: 0,
          skipped_count: 0
        });
      }
    });
  });

  // Step 3: Bulk insert jobTables inside transaction
  await CopyJobTable.bulkCreate(jobTables, { transaction });

  // ✅ Return job.id only; commit/rollback handled by caller
  return job.id;
};

function deriveFinancialYear(fromDate, toDate) {
  const fromYear = new Date(fromDate).getFullYear();
  const toYear = new Date(toDate).getFullYear();
  return `${fromYear}-${toYear}`;
}
