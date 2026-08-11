const { getDb } = require("../../../../utils/getDb");
const CacheTracker = require("../../utils/cacheTracker");
const stageHelperService = require("../common/stageHelpers.service");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const Constants = require("../../../../constants/constantsUtils");

exports.processStage2a = async ({ jobId, records, metadata }) => {
  const db = getDb();

  const groupedRecords = { groups: {} };
  for (const record of records) {
    if (record.table_group) {
      if (!groupedRecords.groups[record.table_group]) groupedRecords.groups[record.table_group] = [];
      groupedRecords.groups[record.table_group].push(record);
    }
  }

  // 🔹 Process journal_entries group (journal_entries + journal_items)
  if (groupedRecords.groups.journalEntries) {
    for (const record of groupedRecords.groups.journalEntries) {
      const { row_data, source_id, s3_key, chunk_index } = record;

      await db.sequelize.transaction(async (t) => {
        try {
          // journal_entries
          const { id: sourceJournalId, ...journalRow } = row_data.journal_entries;

          const [journalEntry, createdJournal] = await stageHelperService.safeUpsert({
            model: db.journalEntry,
            tableName: "journal_entries",
            row_data: journalRow,
            stageCfg: copyJobConfig.stages.data.stage2a,
            db,
            transaction: t
          });

          const chunkMetaJournal = CacheTracker.getChunkSummary(jobId, "journal_entries", Constants.STAGE_IDS.STAGE2A, chunk_index);
          if (!chunkMetaJournal) throw new Error(`Chunk not found for journal_entries and s3_key ${s3_key}`);
          CacheTracker.increment(jobId, "journal_entries", "processed");
          if (createdJournal) CacheTracker.increment(jobId, "journal_entries", "inserted");
          else CacheTracker.increment(jobId, "journal_entries", "skipped");
          CacheTracker.incrementChunk(jobId, "journal_entries", chunkMetaJournal.s3Key, chunkMetaJournal.chunkIndex);

          // inside the transaction, right after journal_entries safeUpsert
          // and before looping journal_items
          await db.journalItem.destroy({
            where: { journal_id: journalEntry.id },
            transaction: t
          });

          // journal_items
          for (const item of row_data.journal_items || []) {
            const { id: sourceItemId, ...itemRow } = item;
            itemRow.journal_id = journalEntry.id;
            itemRow.account_id = CacheTracker.getMapping(jobId, "account_list", itemRow.account_id);
            itemRow.group_id = CacheTracker.getMapping(jobId, "group_list", itemRow.group_id);

            const [journalItem, createdItem] = await stageHelperService.safeUpsert({
              model: db.journalItem,
              tableName: "journal_items",
              row_data: itemRow,
              stageCfg: copyJobConfig.stages.data.stage2a,
              db,
              transaction: t
            });

            const chunkMetaItem = CacheTracker.getChunkSummary(jobId, "journal_items", Constants.STAGE_IDS.STAGE2A, chunk_index);
            if (!chunkMetaItem) throw new Error(`Chunk not found for journal_items and s3_key ${s3_key}`);

            CacheTracker.increment(jobId, "journal_items", "processed");
            if (createdItem) CacheTracker.increment(jobId, "journal_items", "inserted");
            else CacheTracker.increment(jobId, "journal_items", "skipped");
            CacheTracker.incrementChunk(jobId, "journal_items", chunkMetaItem.s3Key, chunkMetaItem.chunkIndex);
          }

          await db.copyJobAudit.create({
            job_id: jobId,
            table_name: "journal_entries",
            source_id,
            target_id: journalEntry.id,
            action: createdJournal ? Constants.AUDIT_ACTIONS.STAGE2A.INSERT_COPYJOB : Constants.AUDIT_ACTIONS.STAGE2A.SKIP_COPYJOB,
            message: JSON.stringify(row_data)
          }, { transaction: t });

          console.log(`✅ Stage2a: journal_entries group processed source:${source_id}`);
        } catch (err) {
          console.error(`❌ Failed to process Stage2a journal_entries group:`, err.message);
          CacheTracker.increment(jobId, "journal_entries", "failed");
          await db.copyJobAudit.create({
            job_id: jobId,
            table_name: "journal_entries",
            source_id,
            target_id: null,
            action: Constants.AUDIT_ACTIONS.STAGE2A.FAIL_COPYJOB,
            message: JSON.stringify({ row_data, error: err.message })
          });
        }
      });

      // Completion check
      try {
        const groupTables = ["journal_entries", "journal_items"];
        const results = groupTables.map(tbl => {
          const summary = CacheTracker.getSummary(jobId, tbl);
          console.log(summary);
          if (!summary || !summary.total || summary.total === 0) return true;
          const totalChunks = CacheTracker.getTotalChunks(jobId, tbl, Constants.STAGE_IDS.STAGE2A);
          return CacheTracker.isComplete(jobId, tbl, totalChunks);
        });
        const allComplete = results.every(Boolean);

        if (allComplete) {
          for (const tbl of groupTables) {
            const totalChunks = CacheTracker.getTotalChunks(jobId, tbl, Constants.STAGE_IDS.STAGE2A);

            console.log(`🎯 Table ${tbl} reached completion in cache`);
            const tableMeta = await db.copyJobTable.findOne({
              where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE2A, table_name: tbl }
            });
            if (tableMeta) {
              await stageHelperService.flushTableSummary({
                db,
                jobId,
                stage: Constants.STAGE_IDS.STAGE2A,
                tableName: tbl,
                tableMetaId: tableMeta.id,
                totalChunks
              });
              await stageHelperService.finalizeStage({
                db,
                jobId,
                stageNumber: Constants.STAGE_IDS.STAGE2A
              });
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error during completion handling for journal_entries group:`, err.message);
      }
    }
  }

  console.log(`🚀 Stage2a processed ${records.length} rows for Job ${jobId}`);
};
