const { getDb } = require("../../../../utils/getDb");
const CacheTracker = require("../../utils/cacheTracker"); // ✅ use tracker
const prepareStage1b = require("../stage1b/prepareTables.service");
const prepareStage1c = require("../stage1c/prepareTables.service");
const prepareStage2a = require("../stage2a/prepareTables.service");
const prepareStage2b = require("../stage2b/prepareTables.service");
const prepareStage2c = require("../stage2c/prepareTables.service");
const prepareStage2d = require("../stage2d/prepareTables.service");
const Constants = require("../../../../constants/constantsUtils"); // ✅ import
const { uploadToS3 } = require("../../../s3Upload.service");

function decideSizeCategory(bundle) {
    const totalRows = Object.values(bundle).reduce((sum, arr) => sum + arr.length, 0);
    if (totalRows < 1000) return "small";
    if (totalRows < 10000) return "medium";
    return "large";
}

exports.uploadStageBundle = async function (job, jobId, stageId, bundle, transaction, db, chunkIndex) {
    const sizeCategory = decideSizeCategory(bundle);

    try {
        const s3Key = await uploadToS3({
            keyPrefix: `jobs/${sizeCategory}/${jobId}/stage${stageId}/`,
            fileName: "config_bundle.json",
            dataBuffer: Buffer.from(JSON.stringify(bundle)),
            contentType: "application/json",
            metadata: {
                job_id: job.id.toString(),
                source_user_id: job.source_user_id.toString(),
                target_user_id: job.target_user_id.toString(),
                from_date: job.from_date?.toString() || "",
                to_date: job.to_date?.toString() || "",
                financial_year: job.financial_year || "",
                stage: stageId.toString(),
                chunk_index: chunkIndex.toString(),
                fileType: "copyJob"
            }
        });
        return s3Key;
    } catch (err) {
        const errorMsg = `Stage ${stageId} failed during S3 upload: ${err.message}`;
        await db.copyJob.update(
            { status: Constants.JOB_STATUS.FAILURE, current_stage: stageId, error_message: errorMsg },
            { where: { id: jobId }, transaction }
        );
        throw new Error(errorMsg);
    }
};

exports.processStageSummary = async ({ groupedRecords }) => {
    const db = getDb();
    const t = await db.sequelize.transaction();

    try {

        for (const [stageBatchId, records] of Object.entries(groupedRecords)) {
            for (const record of records) {
                await handleStageSummary(record, db, t);
            }
            console.log(`✅ CopyJob summary ${stageBatchId} to DB`);
        }
        await t.commit();
        console.log(`✅ All CopyJob Stage summary processed successfully.`);
    } catch (error) {
        await t.rollback();
        console.error("❌ Error processing CopyJob stage summary update:", error);
    }
};

exports.flushTableSummary = async ({ db, jobId, stage, tableName, tableMetaId, totalChunks }) => {
    const summary = CacheTracker.getSummary(jobId, tableName);

    // Update table-level summary
    await db.copyJobTable.update({
        processed_count: summary.processed,
        inserted_count: summary.inserted,
        skipped_count: summary.skipped,
        status: summary.failed > 0 ? Constants.JOB_STATUS.FAILURE : Constants.JOB_STATUS.SUCCESS
    }, { where: { id: tableMetaId } });

    // Loop through all chunks
    for (let i = 0; i < totalChunks; i++) {
        const chunkSummary = CacheTracker.getChunkSummary(jobId, tableName, stage, i);

        if (!chunkSummary.s3Key) continue; // skip if chunk not found

        await db.copyJobChunkTableMap.update({
            processed_count: chunkSummary.processed,
            status: summary.failed > 0
                ? Constants.JOB_STATUS.FAILURE
                : (chunkSummary.processed === chunkSummary.rowCount
                    ? Constants.JOB_STATUS.SUCCESS
                    : Constants.JOB_STATUS.IN_PROGRESS)
        }, {
            where: {
                copy_job_table_id: tableMetaId,
                s3_key: chunkSummary.s3Key,
                chunk_index: chunkSummary.chunkIndex
            }
        });
    }

    console.log(`📦 Flushed ${tableName} summary to DB (all ${totalChunks} chunks)`);
};


exports.finalizeStage = async ({ db, jobId, stageNumber }) => {
    // 🔹 New check: summary must be received
    if (!CacheTracker.hasSummary(jobId, stageNumber)) {
        console.log(`⏳ Job ${jobId} Stage${stageNumber} completed but summary not yet received. Waiting...`);
        return;
    }

    const tables = await db.copyJobTable.findAll({ where: { job_id: jobId, stage: stageNumber } });

    const allCompleted = tables.every(t => t.status === Constants.JOB_STATUS.SUCCESS || t.status === Constants.JOB_STATUS.FAILURE);
    const allSucceeded = tables.every(t => t.status === Constants.JOB_STATUS.SUCCESS);
    const anyFailed = tables.some(t => t.status === Constants.JOB_STATUS.FAILURE);

    if (!allCompleted) {
        console.log(`⏳ Job ${jobId} still in progress for Stage${stageNumber}`);
        return;
    }

    if (anyFailed) {
        await db.copyJob.update(
            { status: Constants.JOB_STATUS.FAILURE, current_stage: stageNumber, error_message: `One or more tables failed in Stage${stageNumber}` },
            { where: { id: jobId } }
        );
        console.error(`❌ Job ${jobId} marked failed at Stage${stageNumber}`);
    } else if (allSucceeded) {
        await db.copyJob.update(
            { status: Constants.JOB_STATUS.SUCCESS, current_stage: stageNumber },
            { where: { id: jobId } }
        );
        console.log(`🎉 Job ${jobId} marked complete for Stage${stageNumber}`);

        // 🔹 Fire-and-forget next stage prep

        for (const t of tables) {
            const summary = CacheTracker.getSummary(jobId, t.table_name);
            if (summary.total > 0) {
                const totalChunks = CacheTracker.getTotalChunks(jobId, t.table_name, stageNumber);
                CacheTracker.cleanup(jobId, t.table_name, totalChunks);
            }
        }

        nextPrepareFn(stageNumber, jobId)
            .then(() => console.log(`🚀 Stage${stageNumber + 1} preparation triggered for Job ${jobId}`))
            .catch(err => console.error(`❌ Failed to trigger Stage${stageNumber + 1} for Job ${jobId}:`, err.message));

    }
};
// Generic helper to handle upsert vs  special case

exports.safeUpsert = async ({ model, tableName, row_data, stageCfg, db, transaction }) => {
    const conflictFields = stageCfg.conflictFields?.[tableName];
    const specialHandling = stageCfg.specialHandling?.[tableName];
    const functionalFields = stageCfg.functionalUnique?.[tableName];
    const mergeFields = stageCfg.mergeFields?.[tableName];

    if (specialHandling === "whereClause") {
        const whereKeys = stageCfg.whereClauseFields?.[tableName] || Object.keys(row_data);
        const where = {};
        for (const key of whereKeys) {
            if (row_data[key] !== null && row_data[key] !== undefined) {
                where[key] = row_data[key];
            }
        }
        const [instance, created] = await model.findOrCreate({ where, defaults: row_data, transaction });
        return [instance, created];
    }

    if (conflictFields) {
        if (functionalFields?.length) {
            const where = { user_id: row_data.user_id, financial_year: row_data.financial_year };
            for (const f of functionalFields) {
                where[f] = db.sequelize.where(
                    db.sequelize.fn("lower", db.sequelize.col(f)),
                    row_data[f].toLowerCase()
                );
            }

            if (mergeFields?.length) {
                const existing = await model.findOne({ where, transaction });
                if (existing) {
                    for (const field of mergeFields) {
                        existing[field] = Number(existing[field] || 0) + Number(row_data[field] || 0);
                    }
                    existing.updatedAt = new Date();
                    await existing.save({ transaction });
                    return [existing, false];
                } else {
                    const instance = await model.create(row_data, { transaction });
                    return [instance, true];
                }
            }

            const [instance, created] = await model.findOrCreate({ where, defaults: row_data, transaction });
            return [instance, created];
        }

        // ✅ Pre-check existence before upsert
        const where = {};
        for (const f of conflictFields) {
            where[f] = row_data[f];
        }
        const existing = await model.findOne({ where, transaction });

        const [instance] = await model.upsert(row_data, { conflictFields, transaction });
        const created = !existing; // true if no row existed before
        return [instance, created];
    }

    const instance = await model.create(row_data, { transaction });
    return [instance, true];
};

function nextPrepareFn(stageNumber, jobId) {
    const stage = Number(stageNumber); // ✅ force to number
    switch (stage) {
        case Constants.STAGE_IDS.STAGE1A:
            return prepareStage1b(jobId)
                .then(() => console.log(`🚀 Stage1b preparation triggered for Job ${jobId}`))
                .catch(err => console.error(`❌ Failed to trigger Stage1b for Job ${jobId}:`, err.message));

        case Constants.STAGE_IDS.STAGE1B:
            return prepareStage1c(jobId)
                .then(() => console.log(`🚀 Stage1c preparation triggered for Job ${jobId}`))
                .catch(err => console.error(`❌ Failed to trigger Stage1c for Job ${jobId}:`, err.message));

        case Constants.STAGE_IDS.STAGE1C:
            return prepareStage2a(jobId)
                .then(() => console.log(`🚀 Stage2a preparation triggered for Job ${jobId}`))
                .catch(err => console.error(`❌ Failed to trigger Stage2a for Job ${jobId}:`, err.message));

        case Constants.STAGE_IDS.STAGE2A:
            return prepareStage2b(jobId)
                .then(() => console.log(`🚀 Stage2b preparation triggered for Job ${jobId}`))
                .catch(err => console.error(`❌ Failed to trigger Stage2b for Job ${jobId}:`, err.message));

        case Constants.STAGE_IDS.STAGE2B:
            return prepareStage2c(jobId)
                .then(() => console.log(`🚀 Stage2c preparation triggered for Job ${jobId}`))
                .catch(err => console.error(`❌ Failed to trigger Stage2c for Job ${jobId}:`, err.message));
        case Constants.STAGE_IDS.STAGE2C:
            return prepareStage2d(jobId)
                .then(() => console.log(`🚀 Stage2c preparation triggered for Job ${jobId}`))
                .catch(err => console.error(`❌ Failed to trigger Stage2c for Job ${jobId}:`, err.message));

        default:
            console.log(`ℹ️ No next stage defined after Stage${stage}`);
            return Promise.resolve();
    }
}

async function handleStageSummary(summary, db, transaction) {
    console.log(summary);

    const { jobId, stage, status, errorMessage, tables, chunk_index } = summary;

    // 🔹 Always acknowledge chunk summary first (success or failure)
    for (const table of tables) {
        const { tableName, generatedCount } = table;
        CacheTracker.setChunkSummaryReceived(jobId, tableName, stage, chunk_index, true, generatedCount);
    }

    if (status === Constants.JOB_STATUS.SUCCESS) {
        // ✅ Success case: reconcile counts
        for (const table of tables) {
            const { tableName } = table;

            const totalChunks = CacheTracker.getTotalChunks(jobId, tableName, stage);
            const receivedChunks = CacheTracker.getReceivedChunks(jobId, tableName, stage);

            if (receivedChunks === totalChunks) {
                // 🔹 Aggregate totals across all chunks
                let aggregate = 0;
                for (let i = 0; i < totalChunks; i++) {
                    const chunkSummary = CacheTracker.getChunkSummary(jobId, tableName, stage, i);
                    if (chunkSummary && chunkSummary.generatedCount != null) {
                        aggregate += Number(chunkSummary.generatedCount) || 0;
                    }
                }

                const trackerSummary = CacheTracker.getSummary(jobId, tableName);
                if (!trackerSummary) {
                    console.warn(`⚠️ No cache summary found for Job ${jobId} table ${tableName}. Skipping reconciliation.`);
                    continue;
                }

                if (trackerSummary.total !== aggregate) {
                    // ❌ mismatch between cache totals and aggregated chunk totals
                    await db.copyJobTable.update(
                        { status: Constants.JOB_STATUS.FAILURE, error_message: "Row count mismatch in summary reconciliation" },
                        { where: { job_id: jobId, table_name: tableName }, transaction }
                    );
                    await db.copyJob.update(
                        { status: Constants.JOB_STATUS.FAILURE, current_stage: stage, error_message: "Row count mismatch in summary reconciliation" },
                        { where: { id: jobId }, transaction }
                    );
                    console.error(`❌ Job ${jobId} table ${tableName} failed: expected ${trackerSummary.total}, got ${aggregate}`);
                } else {
                    console.log(`📦 Table ${tableName} summary reconciled successfully`);
                }
            } else {
                console.log(`⏳ Waiting for all chunks of table ${tableName} before reconciliation...`);
            }
        }

        // 🔹 Mark that overall stage summary has been received
        CacheTracker.setSummary(jobId, stage, true);

        // ✅ After reconciliation, try to finalize stage
        await exports.finalizeStage({
            db,
            jobId,
            stageNumber: stage
        });
    }

    if (status === Constants.JOB_STATUS.FAILURE) {
        // ❌ Failure case
        await db.copyJob.update(
            { status: Constants.JOB_STATUS.FAILURE, current_stage: stage, error_message: errorMessage },
            { where: { id: jobId }, transaction }
        );
        await db.copyJobTable.update(
            { status: Constants.JOB_STATUS.FAILURE, error_message: errorMessage },
            { where: { job_id: jobId }, transaction }
        );
        console.error(`❌ Job ${jobId} failed via summary: ${errorMessage}`);

        // 🔹 Even in failure, mark stage summary received
        CacheTracker.setSummary(jobId, stage, true);

        await exports.finalizeStage({
            db,
            jobId,
            stageNumber: stage
        });
    }
}
