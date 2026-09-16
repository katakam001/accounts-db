const CacheTracker = require("../../utils/cacheTracker");
const Constants = require("../../../../constants/constantsUtils"); // ✅ import
const stageHelperService = require("../common/stageHelpers.service");

module.exports = async function prepareStage1a(jobId, db, transaction) {
    const CopyJob = db.copyJob;
    const CopyJobTable = db.copyJobTable;
    const CopyJobChunkTableMap = db.copyJobChunkTableMap;

    try {
        // Step 1: Fetch job metadata
        const job = await CopyJob.findByPk(jobId, { transaction });
        if (!job) throw new Error(`CopyJob ${jobId} not found`);

        // Step 2: Fetch Stage1a tables
        const tables = await CopyJobTable.findAll({
            where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE1A },
            order: [["order_index", "ASC"], ["sub_order_index", "ASC"]],
            transaction
        });

        const bundle = {};

        // Step 3: Pull data per table
        for (const table of tables) {
            try {
                const rows = await db.sequelize.query(
                    `SELECT * FROM ${table.table_name} 
                     WHERE user_id = :sourceUserId 
                       AND financial_year = :financialYear`,
                    {
                        replacements: {
                            sourceUserId: job.source_user_id,
                            financialYear: job.financial_year
                        },
                        type: db.Sequelize.QueryTypes.SELECT,
                        transaction
                    }
                );

                const filteredRows = rows.map(({ createdAt, updatedAt, ...rest }) => rest);
                bundle[table.table_name] = filteredRows;

                if (filteredRows.length > 0) {
                    CacheTracker.initTable(jobId, table.table_name, filteredRows.length);
                }

            } catch (err) {
                const errorMsg = `Stage1a failed for table ${table.table_name}: ${err.message}`;
                await Promise.all([
                    CopyJob.update(
                        { status: Constants.JOB_STATUS.FAILURE, current_stage: Constants.STAGE_IDS.STAGE1A, error_message: errorMsg },
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

        // Step 4: Decide size category based on bundle size

        const s3Key = await stageHelperService.uploadStageBundle(job, jobId, Constants.STAGE_IDS.STAGE1A, bundle, transaction, db, 0);

        // Step 6: Insert chunk metadata + update table totals
        for (const table of tables) {
            const rows = bundle[table.table_name] || [];

            const chunkRow = await CopyJobChunkTableMap.create({
                copy_job_table_id: table.id,
                chunk_index: 0,
                s3_key: s3Key,
                row_count: rows.length,
                processed_count: 0,
                status: rows.length === 0 ? Constants.JOB_STATUS.SUCCESS : Constants.JOB_STATUS.IN_PROGRESS
            }, { transaction });

            await CopyJobTable.update(
                {
                    total_count: rows.length,
                    deleted_count: 0, // always 0 here
                    status: rows.length === 0 ? Constants.JOB_STATUS.SUCCESS : Constants.JOB_STATUS.IN_PROGRESS
                }, { where: { id: table.id }, transaction }
            );
            CacheTracker.setChunkMeta(
                jobId,
                table.table_name,
                Constants.STAGE_IDS.STAGE1A,
                chunkRow.s3_key,
                chunkRow.chunk_index,
                chunkRow.row_count);
            CacheTracker.incrementChunkTotal(jobId, table.table_name, Constants.STAGE_IDS.STAGE1A);
        }

        await CopyJob.update(
            { status: Constants.JOB_STATUS.IN_PROGRESS, current_stage: Constants.STAGE_IDS.STAGE1A, error_message: null },
            { where: { id: jobId }, transaction }
        );

        // ✅ Trigger SQS consumer monitoring directly
        const monitorService = require("../../../../services/monitor.service");
        monitorService.startMonitoring();

        return { jobId, s3Key };
    } catch (err) {
        await db.copyJob.update(
            { status: Constants.JOB_STATUS.FAILURE, current_stage: Constants.STAGE_IDS.STAGE1A, error_message: err.message },
            { where: { id: jobId }, transaction }
        );
        throw err;
    }
};
