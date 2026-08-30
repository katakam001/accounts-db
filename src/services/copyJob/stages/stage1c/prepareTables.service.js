const CacheTracker = require("../../utils/cacheTracker");
const Constants = require("../../../../constants/constantsUtils");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const { getDb } = require("../../../../utils/getDb");
const stageHelperService = require("../common/stageHelpers.service");

module.exports = async function prepareStage1c(jobId) {
    const db = getDb();
    const transaction = await db.sequelize.transaction();

    try {
        const CopyJob = db.copyJob;
        const CopyJobTable = db.copyJobTable;
        const CopyJobChunkTableMap = db.copyJobChunkTableMap;

        // Step 1: Fetch job metadata
        const job = await CopyJob.findByPk(jobId, { transaction });
        if (!job) throw new Error(`CopyJob ${jobId} not found`);

        // Step 2: Load Stage1c config
        const stageConfig = copyJobConfig.stages.configuration.stage1c;

        const bundle = {
            metadata: {
                independent: stageConfig.tables || [],
                groups: stageConfig.groups || [],
                order: stageConfig.order,
                userScoped: stageConfig.userScoped
            },
            tables: {}
        };

        // Step 3: Fetch Stage1c tables directly from DB
        const tables = await CopyJobTable.findAll({
            where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE1C },
            order: [["order_index", "ASC"], ["sub_order_index", "ASC"]],
            transaction
        });

        // Step 4: Query all tables with one loop + one catch block
        for (const table of tables) {
            try {
                const rows = await db.sequelize.query(
                    `SELECT * FROM ${table.table_name} WHERE user_id=:uid AND financial_year=:fy`,
                    {
                        replacements: { uid: job.source_user_id, fy: job.financial_year },
                        type: db.Sequelize.QueryTypes.SELECT,
                        transaction
                    }
                );
                const filteredRows = rows.map(({ createdAt, updatedAt, ...rest }) => rest);

                bundle.tables[table.table_name] = filteredRows;
                if (filteredRows.length > 0) {
                    CacheTracker.initTable(jobId, table.table_name, filteredRows.length);
                }
            } catch (err) {
                const errorMsg = `Stage1c failed for table ${table.table_name}: ${err.message}`;
                await Promise.all([
                    CopyJob.update(
                        { status: Constants.JOB_STATUS.FAILURE, current_stage: Constants.STAGE_IDS.STAGE1C, error_message: errorMsg },
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

        // Step 5: Upload bundle to S3
        const s3Key = await stageHelperService.uploadStageBundle(
            job, jobId, Constants.STAGE_IDS.STAGE1C, bundle, transaction, db, 0
        );

        // Step 6: Insert chunk metadata + update table totals
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
                {
                    total_count: rows.length,
                    status: rows.length === 0 ? Constants.JOB_STATUS.SUCCESS : Constants.JOB_STATUS.IN_PROGRESS
                },
                { where: { id: tableMeta.id }, transaction }
            );

            CacheTracker.setChunkMeta(jobId, tableName, Constants.STAGE_IDS.STAGE1C,chunkRow.s3_key, chunkRow.chunk_index,chunkRow.row_count);
            CacheTracker.incrementChunkTotal(jobId, tableName, Constants.STAGE_IDS.STAGE1C);
        }

        // Step 7: Update job status
        await CopyJob.update(
            { status: Constants.JOB_STATUS.IN_PROGRESS, current_stage: Constants.STAGE_IDS.STAGE1C, error_message: null },
            { where: { id: jobId }, transaction }
        );

        await transaction.commit();

        // ✅ Trigger SQS consumer monitoring directly
        const monitorService = require("../../../../services/monitor.service");
        monitorService.startMonitoring();

        console.log(`🚀 Stage1c preparation complete for Job ${jobId}`);
        return { jobId, s3Key };
    } catch (err) {
        await transaction.rollback();
        await db.copyJob.update(
            { status: Constants.JOB_STATUS.FAILURE, current_stage: Constants.STAGE_IDS.STAGE1C, error_message: err.message },
            { where: { id: jobId } }
        );
        throw err;
    }
};
