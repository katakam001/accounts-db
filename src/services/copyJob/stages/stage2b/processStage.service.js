const { getDb } = require("../../../../utils/getDb");
const CacheTracker = require("../../utils/cacheTracker");
const stageHelperService = require("../common/stageHelpers.service");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const Constants = require("../../../../constants/constantsUtils");

exports.processStage2b = async ({ jobId, records, metadata }) => {
  const db = getDb();

  const groupedRecords = { groups: {} };
  for (const record of records) {
    if (record.table_group) {
      if (!groupedRecords.groups[record.table_group]) groupedRecords.groups[record.table_group] = [];
      groupedRecords.groups[record.table_group].push(record);
    }
  }

  // 🔹 Process invoices group (journal_entries + journal_items + entries + entry_fields)
  if (groupedRecords.groups.invoices) {
    for (const record of groupedRecords.groups.invoices) {
      const { row_data, source_id, s3_key, chunk_index } = record;

      await db.sequelize.transaction(async (t) => {
        try {
          // journal_entries
          const { id: sourceJournalId, journal_items, entries, ...journalRow } = row_data.journal_entries;

          const userId = entries[0].user_id;
          const financialYear = entries[0].financial_year;
          const type = entries[0].type;
          let next_seq_no = entries[0].sNo;

          // const [[{ next_sequence_id }]] = await db.sequelize.query(
          //   `SELECT nextval('group_entries_seq') AS next_sequence_id`,
          //   { transaction: t }
          // );

          const existingTracker = await db.invoice_tracker.findOne({
            where: { user_id: userId, financial_year: financialYear, type },
            transaction: t
          });

          const [updatedTracker] = await db.invoice_tracker.upsert(
            {
              user_id: userId,
              financial_year: financialYear,
              type,
              last_sno: existingTracker ? existingTracker.last_sno + 1 : 1
            },
            {
              transaction: t,
              returning: true,
              conflictFields: ['user_id', 'financial_year', 'type']
            }
          );

          if (!next_seq_no) {
            next_seq_no = updatedTracker?.last_sno ?? 1;
          }
          // journalRow.invoice_seq_id=next_sequence_id;

          const [journalEntry, createdJournal] = await stageHelperService.safeUpsert({
            model: db.journalEntry,
            tableName: "journal_entries",
            row_data: journalRow,
            stageCfg: copyJobConfig.stages.data.stage2b,
            db,
            transaction: t
          });

          const chunkMetaJournal = CacheTracker.getChunkSummary(jobId, "journal_entries", Constants.STAGE_IDS.STAGE2B, chunk_index);
          if (!chunkMetaJournal) throw new Error(`Chunk not found for journal_entries and s3_key ${s3_key}`);
          CacheTracker.increment(jobId, "journal_entries", "processed");
          if (createdJournal) CacheTracker.increment(jobId, "journal_entries", "inserted");
          else CacheTracker.increment(jobId, "journal_entries", "skipped");
          CacheTracker.incrementChunk(jobId, "journal_entries", chunkMetaJournal.s3Key, chunkMetaJournal.chunkIndex);

          // journal_items
          await db.journalItem.destroy({ where: { journal_id: journalEntry.id }, transaction: t });
          for (const item of journal_items || []) {
            const { id: sourceItemId, ...itemRow } = item;
            itemRow.journal_id = journalEntry.id;
            itemRow.account_id = CacheTracker.getMapping(jobId, "account_list", itemRow.account_id);
            itemRow.group_id = CacheTracker.getMapping(jobId, "group_list", itemRow.group_id);

            const [journalItem, createdItem] = await stageHelperService.safeUpsert({
              model: db.journalItem,
              tableName: "journal_items",
              row_data: itemRow,
              stageCfg: copyJobConfig.stages.data.stage2b,
              db,
              transaction: t
            });

            const chunkMetaItem = CacheTracker.getChunkSummary(jobId, "journal_items", Constants.STAGE_IDS.STAGE2B, chunk_index);
            if (!chunkMetaItem) throw new Error(`Chunk not found for journal_items and s3_key ${s3_key}`);

            CacheTracker.increment(jobId, "journal_items", "processed");
            if (createdItem) CacheTracker.increment(jobId, "journal_items", "inserted");
            else CacheTracker.increment(jobId, "journal_items", "skipped");
            CacheTracker.incrementChunk(jobId, "journal_items", chunkMetaItem.s3Key, chunkMetaItem.chunkIndex);
          }

          // entries
          const entriesToDelete = await db.entry.findAll({
            where: { journal_id: journalEntry.id },
            transaction: t
          });

          for (const entryDelete of entriesToDelete) {
            await db.entryField.destroy({ where: { entry_id: entryDelete.id }, transaction: t });
          }

          await db.entry.destroy({ where: { journal_id: journalEntry.id }, transaction: t });

          for (const entry of entries || []) {
            const { id: sourceEntryId, entry_fields, ...entryRow } = entry;
            entryRow.journal_id = journalEntry.id;
            entryRow.account_id = CacheTracker.getMapping(jobId, "account_list", entryRow.account_id);
            entryRow.category_account_id = CacheTracker.getMapping(jobId, "account_list", entryRow.category_account_id);
            entryRow.category_id = CacheTracker.getMapping(jobId, "categories", entryRow.category_id);
            entryRow.item_id = CacheTracker.getMapping(jobId, "items", entryRow.item_id);
            entryRow.unit_id = CacheTracker.getMapping(jobId, "units", entryRow.unit_id);
            // entryRow.invoice_seq_id = next_sequence_id;
            entryRow.sNo = next_seq_no;

            const [entryObj, createdEntry] = await stageHelperService.safeUpsert({
              model: db.entry,
              tableName: "entries",
              row_data: entryRow,
              stageCfg: copyJobConfig.stages.data.stage2b,
              db,
              transaction: t
            });

            const chunkMetaEntry = CacheTracker.getChunkSummary(jobId, "entries", Constants.STAGE_IDS.STAGE2B, chunk_index);
            if (!chunkMetaEntry) throw new Error(`Chunk not found for entries and s3_key ${s3_key}`);

            CacheTracker.increment(jobId, "entries", "processed");
            if (createdEntry) CacheTracker.increment(jobId, "entries", "inserted");
            else CacheTracker.increment(jobId, "entries", "skipped");
            CacheTracker.incrementChunk(jobId, "entries", chunkMetaEntry.s3Key, chunkMetaEntry.chunkIndex);

            // entry_fields
            for (const field of entry_fields || []) {
              const { id: sourceFieldId, ...fieldRow } = field;
              fieldRow.entry_id = entryObj.id;
              fieldRow.field_id = CacheTracker.getMapping(jobId, "fields", fieldRow.field_id);

              const [entryField, createdField] = await stageHelperService.safeUpsert({
                model: db.entryField,
                tableName: "entry_fields",
                row_data: fieldRow,
                stageCfg: copyJobConfig.stages.data.stage2b,
                db,
                transaction: t
              });

              const chunkMetaField = CacheTracker.getChunkSummary(jobId, "entry_fields", Constants.STAGE_IDS.STAGE2B, chunk_index);
              if (!chunkMetaField) throw new Error(`Chunk not found for entry_fields and s3_key ${s3_key}`);

              CacheTracker.increment(jobId, "entry_fields", "processed");
              if (createdField) CacheTracker.increment(jobId, "entry_fields", "inserted");
              else CacheTracker.increment(jobId, "entry_fields", "skipped");
              CacheTracker.incrementChunk(jobId, "entry_fields", chunkMetaField.s3Key, chunkMetaField.chunkIndex);
            }
          }

          // Audit
          await db.copyJobAudit.create({
            job_id: jobId,
            table_name: "journal_entries",
            source_id,
            target_id: journalEntry.id,
            action: createdJournal ? Constants.AUDIT_ACTIONS.STAGE2B.INSERT_COPYJOB : Constants.AUDIT_ACTIONS.STAGE2B.SKIP_COPYJOB,
            message: JSON.stringify(row_data)
          }, { transaction: t });

          console.log(`✅ Stage2b: invoices group processed source:${source_id}`);
        } catch (err) {
          console.error(`❌ Failed to process Stage2b invoices group:`, err.message);
          CacheTracker.increment(jobId, "journal_entries", "failed");
          await db.copyJobAudit.create({
            job_id: jobId,
            table_name: "journal_entries",
            source_id,
            target_id: null,
            action: Constants.AUDIT_ACTIONS.STAGE2B.FAIL_COPYJOB,
            message: JSON.stringify({ row_data, error: err.message })
          });
        }
      });

      // Completion check
      try {
        const groupTables = ["journal_entries", "journal_items", "entries", "entry_fields"];
        const results = groupTables.map(tbl => {
          const summary = CacheTracker.getSummary(jobId, tbl);
          if (!summary || !summary.total || summary.total === 0) return true;
          const totalChunks = CacheTracker.getTotalChunks(jobId, tbl, Constants.STAGE_IDS.STAGE2B);
          return CacheTracker.isComplete(jobId, tbl, totalChunks);
        });
        const allComplete = results.every(Boolean);

        if (allComplete) {
          for (const tbl of groupTables) {
            const totalChunks = CacheTracker.getTotalChunks(jobId, tbl, Constants.STAGE_IDS.STAGE2B);
            console.log(`🎯 Table ${tbl} reached completion in cache`);
            const tableMeta = await db.copyJobTable.findOne({ where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE2B, table_name: tbl } });
            if (tableMeta) {
              await stageHelperService.flushTableSummary({ db, jobId, stage: Constants.STAGE_IDS.STAGE2B, tableName: tbl, tableMetaId: tableMeta.id, totalChunks });
              await stageHelperService.finalizeStage({ db, jobId, stageNumber: Constants.STAGE_IDS.STAGE2B });
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error during completion handling for invoices group:`, err.message);
      }
    }
  }

  console.log(`🚀 Stage2b processed ${records.length} rows for Job ${jobId}`);
};
