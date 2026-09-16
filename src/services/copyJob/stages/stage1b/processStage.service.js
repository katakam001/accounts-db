const { getDb } = require("../../../../utils/getDb");
const CacheTracker = require("../../utils/cacheTracker");
const stageHelperService = require("../common/stageHelpers.service");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const Constants = require("../../../../constants/constantsUtils"); // ✅ import

exports.processStage1b = async ({ jobId, records, metadata }) => {
    const db = getDb();

    const stage1bModels = {
        category_units: db.categoryUnits,
        conversions: db.conversions,
        opening_stock: db.opening_stock
    };

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

    // 🔹 Process account group
    if (groupedRecords.groups.account) {
        for (const record of groupedRecords.groups.account) {
            const { row_data, source_id, s3_key, chunk_index, is_backup } = record;
            await db.sequelize.transaction(async (t) => {
                try {
                    // account_list
                    const { id: sourceAccountId, ...accountRow } = row_data.account_list;

                    const [account, createdAcc] = await stageHelperService.safeUpsert({
                        model: db.account,
                        tableName: "account_list",
                        row_data: accountRow,
                        stageCfg: copyJobConfig.stages.configuration.stage1b,
                        db,
                        transaction: t, // ✅ transaction
                        is_backup
                    });

                    const chunkMetaAcc = CacheTracker.getChunkSummary(jobId, "account_list", Constants.STAGE_IDS.STAGE1B, chunk_index);
                    CacheTracker.increment(jobId, "account_list", "processed");
                    if (createdAcc) CacheTracker.increment(jobId, "account_list", "inserted");
                    else CacheTracker.increment(jobId, "account_list", "skipped");
                    CacheTracker.addMapping(jobId, "account_list", sourceAccountId, account.id);
                    CacheTracker.incrementChunk(jobId, "account_list", chunkMetaAcc.s3Key, chunkMetaAcc.chunkIndex);

                    // addresses
                    for (const addr of row_data.addresses || []) {
                        const { id: sourceAddrId, ...addrRow } = addr;
                        addrRow.account_id = account.id;
                        const existingAddr = await db.address.findOne({ where: { account_id: account.id, ...addrRow }, transaction: t });
                        const chunkMetaAddr = CacheTracker.getChunkSummary(jobId, "addresses", Constants.STAGE_IDS.STAGE1B, chunk_index);
                        CacheTracker.increment(jobId, "addresses", "processed");
                        if (!existingAddr) {
                            const newAddr = await db.address.create(addrRow, { transaction: t });
                            CacheTracker.increment(jobId, "addresses", "inserted");
                            CacheTracker.addMapping(jobId, "addresses", sourceAddrId, newAddr.id);
                        } else {
                            CacheTracker.increment(jobId, "addresses", "skipped");
                        }
                        CacheTracker.incrementChunk(jobId, "addresses", chunkMetaAddr.s3Key, chunkMetaAddr.chunkIndex);

                    }

                    // account_group
                    for (const ag of row_data.account_group || []) {
                        const { id: sourceAgId, ...agRow } = ag;
                        agRow.account_id = account.id;
                        agRow.group_id = CacheTracker.getMapping(jobId, "group_list", agRow.group_id);
                        const existingAg = await db.accountGroup.findOne({ where: { account_id: account.id, group_id: agRow.group_id }, transaction: t });
                        const chunkMetaAg = CacheTracker.getChunkSummary(jobId, "account_group", Constants.STAGE_IDS.STAGE1B, chunk_index);
                        CacheTracker.increment(jobId, "account_group", "processed");

                        if (!existingAg) {
                            const newAg = await db.accountGroup.create(agRow, { transaction: t });
                            CacheTracker.increment(jobId, "account_group", "inserted");
                            CacheTracker.addMapping(jobId, "account_group", sourceAgId, newAg.id);
                        } else {
                            CacheTracker.increment(jobId, "account_group", "skipped");
                        }
                        CacheTracker.incrementChunk(jobId, "account_group", chunkMetaAg.s3Key, chunkMetaAg.chunkIndex);

                    }
                    await db.copyJobAudit.create({
                        job_id: jobId,
                        table_name: "account_list",
                        source_id,
                        target_id: account.id,
                        action: createdAcc ? Constants.AUDIT_ACTIONS.STAGE1B.INSERT_COPYJOB : Constants.AUDIT_ACTIONS.STAGE1B.SKIP_COPYJOB,
                        message: JSON.stringify(row_data)
                    });
                    console.log(`✅ Stage1b: account group processed source:${source_id}`);

                } catch (err) {
                    console.error(`❌ Failed to process Stage1b account group:`, err.message);
                    CacheTracker.increment(jobId, "account_list", "failed");
                    await db.copyJobAudit.create({
                        job_id: jobId,
                        table_name: "account_list",
                        source_id,
                        target_id: null,
                        action: Constants.AUDIT_ACTIONS.STAGE1B.FAIL_COPYJOB,
                        message: JSON.stringify({ row_data, error: err.message })
                    });
                }
            });
            // ✅ completion check wrapped in try/catch
            try {
                const groupTables = ["account_list", "addresses", "account_group"];
                const results = groupTables.map(tbl => {
                    const summary = CacheTracker.getSummary(jobId, tbl);
                    if (!summary || !summary.total || summary.total === 0) {
                        return true;
                    }
                    const totalChunks = CacheTracker.getTotalChunks(jobId, tbl, Constants.STAGE_IDS.STAGE1B);
                    return CacheTracker.isComplete(jobId, tbl, totalChunks);
                });

                const allComplete = results.every(Boolean);


                if (allComplete) {
                    for (const tbl of groupTables) {
                        const totalChunks = CacheTracker.getTotalChunks(jobId, tbl, Constants.STAGE_IDS.STAGE1B);
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
                                stage: Constants.STAGE_IDS.STAGE1B,
                                tableName: tbl,
                                tableMetaId: tableMeta.id,
                                totalChunks
                            });
                            await stageHelperService.finalizeStage({
                                db,
                                jobId,
                                stageNumber: Constants.STAGE_IDS.STAGE1B
                            });
                        }
                    }
                }
            } catch (err) {
                console.error(`❌ Error during completion handling for account group:`, err.message);
            }
            // After processing account group records
        }
    }

    // 🔹 Process independent tables
    for (const [table_name, tableRecords] of Object.entries(groupedRecords.tables)) {
        const model = stage1bModels[table_name];
        if (!model) {
            console.warn(`⚠️ No model mapped for table ${table_name}`);
            continue;
        }

        const tableMeta = await db.copyJobTable.findOne({ where: { job_id: jobId, table_name } });
        if (!tableMeta) {
            console.error(`❌ copyJobTable not found for ${table_name}`);
            continue;
        }

        // ✅ transaction boundary per table
        for (const record of tableRecords) {
            await db.sequelize.transaction(async (t) => {

                const { row_data, source_id, s3_key, chunk_index } = record;
                try {
                    const chunkMeta = CacheTracker.getChunkSummary(jobId, table_name, Constants.STAGE_IDS.STAGE1B, chunk_index);
                    if (!chunkMeta) throw new Error(`Chunk not found for ${table_name} and s3_key ${s3_key}`);

                    const { id: sourceId, ...cleanRow } = row_data;
                    if (table_name === "category_units") {
                        cleanRow.category_id = CacheTracker.getMapping(jobId, "categories", row_data.category_id);
                        cleanRow.unit_id = CacheTracker.getMapping(jobId, "units", row_data.unit_id);
                    } else if (table_name === "conversions") {
                        cleanRow.from_unit_id = CacheTracker.getMapping(jobId, "units", row_data.from_unit_id);
                        cleanRow.to_unit_id = CacheTracker.getMapping(jobId, "units", row_data.to_unit_id);
                    } else if (table_name === "opening_stock") {
                        cleanRow.item_id = CacheTracker.getMapping(jobId, "items", row_data.item_id);
                    }

                    const [instance, created] = await stageHelperService.safeUpsert({
                        model,
                        tableName: table_name,
                        row_data: cleanRow,
                        stageCfg: copyJobConfig.stages.configuration.stage1b,
                        db,
                        transaction: t   // ✅ pass real transaction
                    });

                    CacheTracker.increment(jobId, table_name, "processed");
                    if (created) CacheTracker.increment(jobId, table_name, "inserted");
                    else CacheTracker.increment(jobId, table_name, "skipped");

                    if (sourceId) CacheTracker.addMapping(jobId, table_name, sourceId, instance.id);
                    CacheTracker.incrementChunk(jobId, table_name, chunkMeta.s3Key, chunkMeta.chunkIndex);

                    await db.copyJobAudit.create({
                        job_id: jobId,
                        table_name,
                        source_id,
                        target_id: instance.id,
                        action: created ? Constants.AUDIT_ACTIONS.STAGE1B.INSERT_COPYJOB : Constants.AUDIT_ACTIONS.STAGE1B.SKIP_COPYJOB,
                        message: JSON.stringify(row_data)
                    }, { transaction: t });

                    console.log(`✅ Stage1b: ${table_name} source:${sourceId} → target:${instance.id}`);

                } catch (err) {
                    console.error(`❌ Failed to process Stage1b record for ${table_name}:`, err.message);
                    CacheTracker.increment(jobId, table_name, "failed");
                    await db.copyJobAudit.create({
                        job_id: jobId,
                        table_name,
                        source_id,
                        target_id: null,
                        action: Constants.AUDIT_ACTIONS.STAGE1B.FAIL_COPYJOB,
                        message: JSON.stringify({ row_data, error: err.message })
                    }, { transaction: t });
                }
            });

            // ✅ completion check wrapped in try/catch
            try {
                const totalChunks = CacheTracker.getTotalChunks(jobId, table_name, Constants.STAGE_IDS.STAGE1B);
                if (CacheTracker.isComplete(jobId, table_name, totalChunks)) {
                    console.log(`🎯 Table ${table_name} reached completion in cache`);
                    const tableMeta = await db.copyJobTable.findOne({
                        where: { job_id: jobId, table_name }
                    });
                    if (!tableMeta) {
                        console.error(`❌ CopyJobTable not found for ${table_name}`);
                    } else {
                        await stageHelperService.flushTableSummary({
                            db,
                            jobId,
                            stage: Constants.STAGE_IDS.STAGE1B,
                            tableName: table_name,
                            tableMetaId: tableMeta.id,
                            totalChunks
                        });
                        await stageHelperService.finalizeStage({
                            db,
                            jobId,
                            stageNumber: Constants.STAGE_IDS.STAGE1B
                        });
                    }
                }
            } catch (err) {
                console.error(`❌ Error during completion handling for ${table_name}:`, err.message);
            }
        }
    }
    console.log(`🚀 Stage1b processed ${records.length} rows for Job ${jobId}`);
};
