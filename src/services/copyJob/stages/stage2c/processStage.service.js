const { getDb } = require("../../../../utils/getDb");
const CacheTracker = require("../../utils/cacheTracker");
const stageHelperService = require("../common/stageHelpers.service");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const Constants = require("../../../../constants/constantsUtils");

exports.processStage2c = async ({ jobId, records, metadata }) => {
  const db = getDb();

  const stage2cModels = {
    cash_entries: db.cash,
    cash_entries_batch: db.cashEntriesBatch
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

  // 🔹 Process production_entries group
  if (groupedRecords.groups.production_entries_group) {
    for (const record of groupedRecords.groups.production_entries_group) {
      const { row_data, source_id, s3_key, chunk_index } = record;
      await db.sequelize.transaction(async (t) => {
        try {
          const rootRow = row_data.production_entries;
          const { id: sourceRootId, production_entries: children, ...rootClean } = rootRow;


          // FK mappings
          rootClean.raw_item_id = CacheTracker.getMapping(jobId, "items", rootClean.raw_item_id);
          rootClean.item_id = CacheTracker.getMapping(jobId, "items", rootClean.item_id);
          rootClean.unit_id = CacheTracker.getMapping(jobId, "units", rootClean.unit_id);
          rootClean.conversion_id = CacheTracker.getMapping(jobId, "conversions", rootClean.conversion_id);
          console.log(rootClean);

          const [rootEntry, createdRoot] = await stageHelperService.safeUpsert({
            model: db.production_entries,
            tableName: "production_entries",
            row_data: rootClean,
            stageCfg: copyJobConfig.stages.data.stage2c,
            db,
            transaction: t
          });

          const chunkMetaRoot = CacheTracker.getChunkSummary(jobId, "production_entries", Constants.STAGE_IDS.STAGE2C, chunk_index);
          if (!chunkMetaRoot) throw new Error(`Chunk not found for production_entries and s3_key ${s3_key}`);

          CacheTracker.increment(jobId, "production_entries", "processed");
          CacheTracker.increment(jobId, "production_entries", createdRoot ? "inserted" : "skipped");
          CacheTracker.incrementChunk(jobId, "production_entries", chunkMetaRoot.s3Key, chunkMetaRoot.chunkIndex);
          await db.production_entries.destroy({
            where: { production_entry_id: rootEntry.id },
            transaction: t
          });
          // Children
          for (const child of children || []) {
            const { id: sourceChildId, ...childClean } = child;
            childClean.raw_item_id = CacheTracker.getMapping(jobId, "items", childClean.raw_item_id);
            childClean.item_id = CacheTracker.getMapping(jobId, "items", childClean.item_id);
            childClean.unit_id = CacheTracker.getMapping(jobId, "units", childClean.unit_id);
            childClean.conversion_id = CacheTracker.getMapping(jobId, "conversions", childClean.conversion_id);
            childClean.production_entry_id = rootEntry.id;
            console.log(childClean);

            const [childEntry, createdChild] = await stageHelperService.safeUpsert({
              model: db.production_entries,
              tableName: "children",
              row_data: childClean,
              stageCfg: copyJobConfig.stages.data.stage2c,
              db,
              transaction: t
            });

            CacheTracker.increment(jobId, "production_entries", "processed");
            CacheTracker.increment(jobId, "production_entries", createdChild ? "inserted" : "skipped");
            CacheTracker.incrementChunk(jobId, "production_entries", chunkMetaRoot.s3Key, chunkMetaRoot.chunkIndex);
          }

          await db.copyJobAudit.create({
            job_id: jobId,
            table_name: "production_entries",
            source_id,
            target_id: rootEntry.id,
            action: createdRoot ? Constants.AUDIT_ACTIONS.STAGE2C.INSERT_COPYJOB : Constants.AUDIT_ACTIONS.STAGE2C.SKIP_COPYJOB,
            message: JSON.stringify(row_data)
          }, { transaction: t });

          console.log(`✅ Stage2c: production_entries group processed source:${source_id}`);
        } catch (err) {
          console.error(`❌ Stage2c production_entries group failed:`, err.message);
          CacheTracker.increment(jobId, "production_entries", "failed");
        }
      });

      // Completion check for production_entries
      try {
        const totalChunks = CacheTracker.getTotalChunks(jobId, "production_entries", Constants.STAGE_IDS.STAGE2C);
        if (CacheTracker.isComplete(jobId, "production_entries", totalChunks)) {
          console.log(`🎯 Table production_entries reached completion in cache`);
          const tableMeta = await db.copyJobTable.findOne({ where: { job_id: jobId, table_name: "production_entries" } });
          if (tableMeta) {
            await stageHelperService.flushTableSummary({
              db,
              jobId,
              stage: Constants.STAGE_IDS.STAGE2C,
              tableName: "production_entries",
              tableMetaId: tableMeta.id,
              totalChunks
            });
            await stageHelperService.finalizeStage({ db, jobId, stageNumber: Constants.STAGE_IDS.STAGE2C });
          }
        }
      } catch (err) {
        console.error(`❌ Error during completion handling for production_entries:`, err.message);
      }
    }
  }

  // 🔹 Process independent tables (cash_entries, cash_entries_batch)
  for (const tableName of ["cash_entries", "cash_entries_batch"]) {
    const model = stage2cModels[tableName];
    if (!model) {
      console.warn(`⚠️ No model mapped for table ${tableName}`);
      continue;
    }
    if (groupedRecords.tables[tableName]) {
      for (const record of groupedRecords.tables[tableName]) {
        await db.sequelize.transaction(async (t) => {
          const { row_data, source_id, s3_key, chunk_index } = record;
          try {
            const { id: sourceId, ...cleanRow } = row_data;
            cleanRow.account_id = CacheTracker.getMapping(jobId, "account_list", cleanRow.account_id);
            cleanRow.group_id = CacheTracker.getMapping(jobId, "group_list", cleanRow.group_id);
            console.log(cleanRow);

            const [instance, created] = await stageHelperService.safeUpsert({
              model,
              tableName,
              row_data: cleanRow,
              stageCfg: copyJobConfig.stages.data.stage2c,
              db,
              transaction: t
            });

            const chunkMeta = CacheTracker.getChunkSummary(jobId, tableName, Constants.STAGE_IDS.STAGE2C, chunk_index);
            if (!chunkMeta) throw new Error(`Chunk not found for ${tableName} and s3_key ${s3_key}`);

            CacheTracker.increment(jobId, tableName, "processed");
            CacheTracker.increment(jobId, tableName, created ? "inserted" : "skipped");
            CacheTracker.incrementChunk(jobId, tableName, chunkMeta.s3Key, chunkMeta.chunkIndex);

            await db.copyJobAudit.create({
              job_id: jobId,
              table_name: tableName,
              source_id,
              target_id: instance.id,
              action: created ? Constants.AUDIT_ACTIONS.STAGE2C.INSERT_COPYJOB : Constants.AUDIT_ACTIONS.STAGE2C.SKIP_COPYJOB,
              message: JSON.stringify(row_data)
            }, { transaction: t });

            console.log(`✅ Stage2c: ${tableName} source:${sourceId} → target:${instance.id}`);
          } catch (err) {
            console.error(`❌ Stage2c record failed for ${tableName}:`, err.message);
            CacheTracker.increment(jobId, tableName, "failed");
          }
        });
      }

      // Completion check for independents
      try {
        const totalChunks = CacheTracker.getTotalChunks(jobId, tableName, Constants.STAGE_IDS.STAGE2C);
        if (CacheTracker.isComplete(jobId, tableName, totalChunks)) {
          console.log(`🎯 Table ${tableName} reached completion in cache`);
          const tableMeta = await db.copyJobTable.findOne({ where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE2C, table_name: tableName } });

          if (tableMeta) {
            await stageHelperService.flushTableSummary({
              db,
              jobId,
              stage: Constants.STAGE_IDS.STAGE2C,
              tableName,
              tableMetaId: tableMeta.id,
              totalChunks
            });
            await stageHelperService.finalizeStage({ db, jobId, stageNumber: Constants.STAGE_IDS.STAGE2C });
          }
        }
      } catch (err) {
        console.error(`❌ Error during completion handling for fields_mapping:`, err.message);
      }

    }
  }
  console.log(`🚀 Stage1c processed ${records.length} rows for Job ${jobId}`);
};