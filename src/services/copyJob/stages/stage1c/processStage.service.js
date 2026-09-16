const { getDb } = require("../../../../utils/getDb");
const CacheTracker = require("../../utils/cacheTracker");
const stageHelperService = require("../common/stageHelpers.service");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const Constants = require("../../../../constants/constantsUtils");

exports.processStage1c = async ({ jobId, records, metadata }) => {
    const db = getDb();

    const groupedRecords = { tables: {}, groups: {} };
    for (const record of records) {
        if (record.table_group) {
            if (!groupedRecords.groups[record.table_group]) groupedRecords.groups[record.table_group] = [];
            groupedRecords.groups[record.table_group].push(record);
        } else {
            const { table_name } = record;
            if (!groupedRecords.tables[table_name]) groupedRecords.tables[table_name] = [];
            groupedRecords.tables[table_name].push(record);
        }
    }

    // 🔹 Process yield group (raw_items + processed_items)
    if (groupedRecords.groups.yield) {
        for (const record of groupedRecords.groups.yield) {
            const { row_data, source_id, s3_key, chunk_index } = record;
            await db.sequelize.transaction(async (t) => {
                try {
                    // raw_items
                    const { id: sourceRawId, ...rawRow } = row_data.raw_items;
                    rawRow.item_id = CacheTracker.getMapping(jobId, "items", rawRow.item_id);
                    rawRow.unit_id = CacheTracker.getMapping(jobId, "units", rawRow.unit_id);

                    const [rawItem, createdRaw] = await stageHelperService.safeUpsert({
                        model: db.raw_items,
                        tableName: "raw_items",
                        row_data: rawRow,
                        stageCfg: copyJobConfig.stages.configuration.stage1c,
                        db,
                        transaction: t
                    });

                    const chunkMetaRaw = CacheTracker.getChunkSummary(jobId, "raw_items",Constants.STAGE_IDS.STAGE1C, chunk_index);
                    if (!chunkMetaRaw) throw new Error(`Chunk not found for yield and s3_key ${s3_key}`);

                    CacheTracker.increment(jobId, "raw_items", "processed");
                    if (createdRaw) CacheTracker.increment(jobId, "raw_items", "inserted");
                    else CacheTracker.increment(jobId, "raw_items", "skipped");
                    CacheTracker.addMapping(jobId, "raw_items", sourceRawId, rawItem.id);
                    CacheTracker.incrementChunk(jobId, "raw_items", chunkMetaRaw.s3Key, chunkMetaRaw.chunkIndex);

                    // processed_items
                    for (const proc of row_data.processed_items || []) {
                        const { id: sourceProcId, ...procRow } = proc;
                        procRow.raw_item_id = rawItem.id;
                        procRow.item_id = CacheTracker.getMapping(jobId, "items", procRow.item_id);
                        procRow.unit_id = CacheTracker.getMapping(jobId, "units", procRow.unit_id);
                        procRow.conversion_id = CacheTracker.getMapping(jobId, "conversions", procRow.conversion_id);

                        const [procItem, createdProc] = await stageHelperService.safeUpsert({
                            model: db.processed_items,
                            tableName: "processed_items",
                            row_data: procRow,
                            stageCfg: copyJobConfig.stages.configuration.stage1c,
                            db,
                            transaction: t
                        });

                        const chunkMetaProc = CacheTracker.getChunkSummary(jobId, "processed_items",Constants.STAGE_IDS.STAGE1C, chunk_index);
                        CacheTracker.increment(jobId, "processed_items", "processed");
                        if (createdProc) CacheTracker.increment(jobId, "processed_items", "inserted");
                        else CacheTracker.increment(jobId, "processed_items", "skipped");
                        CacheTracker.addMapping(jobId, "processed_items", sourceProcId, procItem.id);
                        CacheTracker.incrementChunk(jobId, "processed_items", chunkMetaProc.s3Key, chunkMetaProc.chunkIndex);
                    }

                    await db.copyJobAudit.create({
                        job_id: jobId,
                        table_name: "raw_items",
                        source_id,
                        target_id: rawItem.id,
                        action: createdRaw ? Constants.AUDIT_ACTIONS.STAGE1C.INSERT_COPYJOB : Constants.AUDIT_ACTIONS.STAGE1C.SKIP_COPYJOB,
                        message: JSON.stringify(row_data)
                    }, { transaction: t });

                    console.log(`✅ Stage1c: yield group processed source:${source_id}`);
                } catch (err) {
                    console.error(`❌ Failed to process Stage1c yield group:`, err.message);
                    CacheTracker.increment(jobId, "raw_items", "failed");
                    await db.copyJobAudit.create({
                        job_id: jobId,
                        table_name: "raw_items",
                        source_id,
                        target_id: null,
                        action: Constants.AUDIT_ACTIONS.STAGE1C.FAIL_COPYJOB,
                        message: JSON.stringify({ row_data, error: err.message })
                    });
                }
            });

            // Completion check
            try {
                const yieldGroup = ["raw_items", "processed_items"];

                const results = yieldGroup.map(tbl => {
                    const summary = CacheTracker.getSummary(jobId, tbl);
                    if (!summary || !summary.total || summary.total === 0) {
                        return true;
                    }
                    const totalChunks = CacheTracker.getTotalChunks(jobId, tbl, Constants.STAGE_IDS.STAGE1C);
                    return CacheTracker.isComplete(jobId, tbl, totalChunks);
                });

                const allComplete = results.every(Boolean);


                if (allComplete) {
                    for (const tbl of yieldGroup) {
                        const totalChunks = CacheTracker.getTotalChunks(jobId, tbl, Constants.STAGE_IDS.STAGE1C);

                        console.log(`🎯 Table ${tbl} reached completion in cache`);
                        const tableMeta = await db.copyJobTable.findOne({
                            where: { job_id: jobId, table_name: tbl }
                        });
                        if (!tableMeta) {
                            console.error(`❌ CopyJobTable not found for ${tbl}`);
                        } else {
                            await stageHelperService.flushTableSummary({
                                db,
                                jobId,
                                stage: Constants.STAGE_IDS.STAGE1C,
                                tableName: tbl,
                                tableMetaId: tableMeta.id,
                                totalChunks
                            });
                            await stageHelperService.finalizeStage({
                                db,
                                jobId,
                                stageNumber: Constants.STAGE_IDS.STAGE1C
                            });
                        }
                    }
                }
            } catch (err) {
                console.error(`❌ Error during completion handling for yield group:`, err.message);
            }
        }
    }

    // 🔹 Process independent table: fields_mapping
    if (groupedRecords.tables.fields_mapping) {
        for (const record of groupedRecords.tables.fields_mapping) {
            await db.sequelize.transaction(async (t) => {
                const { row_data, source_id, s3_key, chunk_index } = record;
                try {
                    const chunkMeta = CacheTracker.getChunkSummary(jobId, "fields_mapping",Constants.STAGE_IDS.STAGE1C, chunk_index);
                    if (!chunkMeta) throw new Error(`Chunk not found for fields_mapping and s3_key ${s3_key}`);

                    const { id: sourceId, ...cleanRow } = row_data;
                    cleanRow.account_id = CacheTracker.getMapping(jobId, "account_list", row_data.account_id);
                    cleanRow.category_id = CacheTracker.getMapping(jobId, "categories", row_data.category_id);
                    cleanRow.field_id = CacheTracker.getMapping(jobId, "fields", row_data.field_id);

                    const [instance, created] = await stageHelperService.safeUpsert({
                        model: db.fieldsMapping,
                        tableName: "fields_mapping",
                        row_data: cleanRow,
                        stageCfg: copyJobConfig.stages.configuration.stage1c,
                        db,
                        transaction: t
                    });

                    CacheTracker.increment(jobId, "fields_mapping", "processed");
                    if (created) CacheTracker.increment(jobId, "fields_mapping", "inserted");
                    else CacheTracker.increment(jobId, "fields_mapping", "skipped");

                    if (sourceId) CacheTracker.addMapping(jobId, "fields_mapping", sourceId, instance.id);
                    CacheTracker.incrementChunk(jobId, "fields_mapping", chunkMeta.s3Key, chunkMeta.chunkIndex);

                    await db.copyJobAudit.create({
                        job_id: jobId,
                        table_name: "fields_mapping",
                        source_id,
                        target_id: instance.id,
                        action: created ? Constants.AUDIT_ACTIONS.STAGE1C.INSERT_COPYJOB : Constants.AUDIT_ACTIONS.STAGE1C.SKIP_COPYJOB,
                        message: JSON.stringify(row_data)
                    }, { transaction: t });

                    console.log(`✅ Stage1c: fields_mapping source:${sourceId} → target:${instance.id}`);
                } catch (err) {
                    console.error(`❌ Failed to process Stage1c record for fields_mapping:`, err.message);
                    CacheTracker.increment(jobId, "fields_mapping", "failed");
                    await db.copyJobAudit.create({
                        job_id: jobId,
                        table_name: "fields_mapping",
                        source_id,
                        target_id: null,
                        action: Constants.AUDIT_ACTIONS.STAGE1C.FAIL_COPYJOB,
                        message: JSON.stringify({ row_data, error: err.message })
                    }, { transaction: t });
                }
            });

            // ✅ completion check wrapped in try/catch
            try {
                const totalChunks = CacheTracker.getTotalChunks(jobId, "fields_mapping", Constants.STAGE_IDS.STAGE1C);
                if (CacheTracker.isComplete(jobId, "fields_mapping", totalChunks)) {
                    console.log(`🎯 Table fields_mapping reached completion in cache`);
                    const tableMeta = await db.copyJobTable.findOne({
                        where: { job_id: jobId, table_name: "fields_mapping" }
                    });
                    if (!tableMeta) {
                        console.error(`❌ CopyJobTable not found for fields_mapping`);
                    } else {
                        await stageHelperService.flushTableSummary({
                            db,
                            jobId,
                            stage: Constants.STAGE_IDS.STAGE1C,
                            tableName: "fields_mapping",
                            tableMetaId: tableMeta.id,
                            totalChunks
                        });
                        await stageHelperService.finalizeStage({
                            db,
                            jobId,
                            stageNumber: Constants.STAGE_IDS.STAGE1C
                        });
                    }
                }
            } catch (err) {
                console.error(`❌ Error during completion handling for fields_mapping:`, err.message);
            }
        }
    }
    console.log(`🚀 Stage1c processed ${records.length} rows for Job ${jobId}`);
};
