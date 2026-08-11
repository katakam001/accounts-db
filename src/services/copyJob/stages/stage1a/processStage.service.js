const { getDb } = require("../../../../utils/getDb");
const CacheTracker = require("../../utils/cacheTracker");
const stageHelperService = require("../common/stageHelpers.service");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const Constants = require("../../../../constants/constantsUtils"); // ✅ import

exports.processStage1a = async ({ jobId, records }) => {
    const db = getDb();

    const stage1aModels = {
        group_list: db.group,
        categories: db.categories,
        items: db.items,
        units: db.units,
        fields: db.fields,
        areas: db.areas,
        brokers: db.brokers
    };

    const groupedRecords = {};
    for (const record of records) {
        const { table_name } = record;
        if (!groupedRecords[table_name]) groupedRecords[table_name] = [];
        groupedRecords[table_name].push(record);
    }

    for (const [table_name, tableRecords] of Object.entries(groupedRecords)) {
        const model = stage1aModels[table_name];
        if (!model) {
            console.warn(`⚠️ No model mapped for table ${table_name}`);
            continue;
        }

        // ✅ transaction boundary per table
        for (const record of tableRecords) {
            const { row_data, source_id, s3_key, chunk_index } = record;
            await db.sequelize.transaction(async (t) => {

                try {
                    const chunkMeta = CacheTracker.getChunkSummary(jobId, table_name, Constants.STAGE_IDS.STAGE1A, chunk_index);
                    if (!chunkMeta) throw new Error(`Chunk not found for ${table_name} and s3_key ${s3_key}`);

                    const [instance, created] = await stageHelperService.safeUpsert({
                        model,
                        tableName: table_name,
                        row_data,
                        stageCfg: copyJobConfig.stages.configuration.stage1a,
                        db,
                        transaction: t // ✅ transaction
                    });

                    CacheTracker.increment(jobId, table_name, "processed");
                    if (created) {
                        CacheTracker.increment(jobId, table_name, "inserted");
                    } else {
                        CacheTracker.increment(jobId, table_name, "skipped");
                    }
                    if (source_id) {
                        CacheTracker.addMapping(jobId, table_name, source_id, instance.id);
                    }

                    CacheTracker.incrementChunk(jobId, table_name, chunkMeta.s3Key, chunkMeta.chunkIndex);

                    await db.copyJobAudit.create({
                        job_id: jobId,
                        table_name,
                        source_id,
                        target_id: instance.id,
                        action: created ? Constants.AUDIT_ACTIONS.STAGE1A.INSERT_COPYJOB : Constants.AUDIT_ACTIONS.STAGE1A.SKIP_COPYJOB,
                        message: JSON.stringify(row_data)
                    }, { transaction: t });

                    // ✅ improved logging
                    console.log(
                        `Row source:${source_id} → target:${instance.id} ` +
                        `[${created ? "INSERTED" : "SKIPPED/UPDATED"}] in ${table_name}`
                    );

                } catch (err) {
                    console.error(`❌ Failed to upsert row in ${table_name}:`, err.message);
                    CacheTracker.increment(jobId, table_name, "failed");

                    await db.copyJobAudit.create({
                        job_id: jobId,
                        table_name,
                        source_id,
                        target_id: null,
                        action: Constants.AUDIT_ACTIONS.STAGE1A.FAIL_COPYJOB,
                        message: JSON.stringify({ row_data, error: err.message })
                    }, { transaction: t });
                }
            });
            // ✅ completion check wrapped in try/catch
            try {
                const totalChunks = CacheTracker.getTotalChunks(jobId, table_name, Constants.STAGE_IDS.STAGE1A);
                if (CacheTracker.isComplete(jobId, table_name, totalChunks)) {
                    console.log(`🎯 Table ${table_name} reached completion in cache`);

                    // 🔹 No transaction here — row inserts are already committed
                    const tableMeta = await db.copyJobTable.findOne({
                        where: { job_id: jobId, table_name }
                    });

                    if (!tableMeta) {
                        console.error(`❌ CopyJobTable not found for ${table_name}`);
                    } else {
                        // 🔹 Flush summary without transaction
                        await stageHelperService.flushTableSummary({
                            db,
                            jobId,
                            stage: Constants.STAGE_IDS.STAGE1A,
                            tableName: table_name,
                            tableMetaId: tableMeta.id,
                            totalChunks
                        });

                        // 🔹 Finalize stage without transaction
                        await stageHelperService.finalizeStage({
                            db,
                            jobId,
                            stageNumber: Constants.STAGE_IDS.STAGE1A
                        });
                    }
                }
            } catch (err) {
                console.error(`❌ Error during completion handling for ${table_name}:`, err.message);
            }

        }

        console.log(`✅ Processed ${tableRecords.length} rows for table ${table_name}`);
    }

    console.log(`✅ Stage1a processed ${records.length} rows for Job ${jobId}`);
};
