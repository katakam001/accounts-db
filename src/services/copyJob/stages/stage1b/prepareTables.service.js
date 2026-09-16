const { uploadToS3 } = require("../../../s3Upload.service");
const CacheTracker = require("../../utils/cacheTracker");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const { getDb } = require("../../../../utils/getDb");
const Constants = require("../../../../constants/constantsUtils"); // ✅ import
const stageHelperService = require("../common/stageHelpers.service");

module.exports = async function prepareStage1b(jobId) {
    const db = getDb();
    const transaction = await db.sequelize.transaction();
    let s3Key;

    try {
        const CopyJob = db.copyJob;
        const CopyJobTable = db.copyJobTable;
        const CopyJobChunkTableMap = db.copyJobChunkTableMap;

        // Step 1: Fetch job metadata
        const job = await CopyJob.findByPk(jobId, { transaction });
        if (!job) throw new Error(`CopyJob ${jobId} not found`);

        const stageConfig = copyJobConfig.stages.configuration.stage1b;

        const bundle = {
            metadata: {
                independent: stageConfig.tables,
                groups: stageConfig.groups || [],
                order: stageConfig.order,
                userScoped: stageConfig.userScoped
            },
            tables: {}
        };

        // Step 2: Pull data per table
        for (const table of await CopyJobTable.findAll({
            where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE1B },
            order: [["order_index", "ASC"], ["sub_order_index", "ASC"]],
            transaction
        })) {
            try {
                let rows;

                // ✅ Special handling for account_group
                if (table.table_name === "account_group") {
                    rows = await db.sequelize.query(
                        `SELECT ag.* 
                         FROM account_group ag
                         JOIN account_list al ON ag.account_id = al.id
                         WHERE al.user_id = :uid AND al.financial_year = :fy`,
                        {
                            replacements: { uid: job.source_user_id, fy: job.financial_year },
                            type: db.Sequelize.QueryTypes.SELECT,
                            transaction
                        }
                    );
                }
                // ✅ Special handling for addresses
                else if (table.table_name === "addresses") {
                    rows = await db.sequelize.query(
                        `SELECT addr.* 
                         FROM addresses addr
                         JOIN account_list al ON addr.account_id = al.id
                         WHERE al.user_id = :uid AND al.financial_year = :fy`,
                        {
                            replacements: { uid: job.source_user_id, fy: job.financial_year },
                            type: db.Sequelize.QueryTypes.SELECT,
                            transaction
                        }
                    );
                }
                // ✅ Normal query for other tables
                else {
                    rows = await db.sequelize.query(
                        `SELECT * FROM ${table.table_name} 
                         WHERE user_id = :uid AND financial_year = :fy`,
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


            } catch (err) {
                const errorMsg = `Stage1b failed for table ${table.table_name}: ${err.message}`;
                await Promise.all([
                    CopyJob.update(
                        { status: Constants.JOB_STATUS.FAILURE, current_stage: Constants.STAGE_IDS.STAGE1B, error_message: errorMsg },
                        { where: { id: jobId }, transaction }
                    ),
                    CopyJobTable.update(
                        { status: Constants.JOB_STATUS.FAILURE, error_message: errorMsg },
                        { where: { id: table.id }, transaction }
                    )
                ]);
                throw new Error(errorMsg);
            }
        }

        // Step 3: Decide size category based on bundle size
        const s3Key = await stageHelperService.uploadStageBundle(job, jobId, Constants.STAGE_IDS.STAGE1B, bundle, transaction, db, 0);

        // Step 5: Insert chunk metadata + update table totals
        for (const [tableName, rows] of Object.entries(bundle.tables)) {
            const tableMeta = await CopyJobTable.findOne({
                where: { job_id: job.id, table_name: tableName },
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
                { total_count: rows.length, deleted_count: 0, status: rows.length === 0 ? Constants.JOB_STATUS.SUCCESS : Constants.JOB_STATUS.IN_PROGRESS },
                { where: { id: tableMeta.id }, transaction }
            );
            CacheTracker.setChunkMeta(jobId, tableName, Constants.STAGE_IDS.STAGE1B, chunkRow.s3_key, chunkRow.chunk_index, chunkRow.row_count);
            CacheTracker.incrementChunkTotal(jobId, tableName, Constants.STAGE_IDS.STAGE1B);
        }

        await CopyJob.update(
            { status: Constants.JOB_STATUS.IN_PROGRESS, current_stage: Constants.STAGE_IDS.STAGE1B, error_message: null },
            { where: { id: jobId }, transaction }
        );

        await transaction.commit();

        console.log(`🚀 Stage1b preparation complete for Job ${jobId}`);
        // ✅ Trigger SQS consumer monitoring directly
    } catch (err) {
        await transaction.rollback();
        await db.copyJob.update(
            { status: Constants.JOB_STATUS.FAILURE, current_stage: Constants.STAGE_IDS.STAGE1B, error_message: err.message },
            { where: { id: jobId } }
        );
        throw err;
    }
    // ✅ Orchestration outside transaction
    try {
        // At the bottom of your try block
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
};
