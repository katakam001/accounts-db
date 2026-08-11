const { getDb } = require("../../../../utils/getDb");
const CacheTracker = require("../../utils/cacheTracker");
const stageHelperService = require("../common/stageHelpers.service");
const copyJobConfig = require("../../../../constants/copyJobMeta");
const Constants = require("../../../../constants/constantsUtils");

exports.processStage2d = async ({ jobId, records, metadata }) => {
  const db = getDb();

  const groupedRecords = { groups: {} };
  for (const record of records) {
    if (record.table_group) {
      if (!groupedRecords.groups[record.table_group]) groupedRecords.groups[record.table_group] = [];
      groupedRecords.groups[record.table_group].push(record);
    }
  }

  // 🔹 Process cashSalesByDate group
  if (groupedRecords.groups.cashSalesByDate) {
    for (const record of groupedRecords.groups.cashSalesByDate) {
      const { row_data, s3_key, chunk_index } = record;
      const latestJobId = row_data.latestJobId; // ✅ now inside row_data

      await db.sequelize.transaction(async (t) => {
        try {
          await db.sequelize.query(`
            DELETE FROM cash_sale_entry_links l
            USING daily_cash_entry_summary s
            WHERE l.summary_id = s.id
              AND s.entry_date = :entryDate
              AND s.user_id = :userId
              AND s.financial_year = :financialYear;

            DELETE FROM daily_cash_entry_summary s
            WHERE s.entry_date = :entryDate
              AND s.user_id = :userId
              AND s.financial_year = :financialYear;
              `, {
            replacements: {
              entryDate: row_data.entry_date,
              userId: row_data.user_id,
              financialYear: row_data.financial_year
            },
            transaction: t
          });

          // 🔹 NEW: Delete auto‑generated ledger rows for this date group
          await db.sequelize.query(`
            DELETE FROM cash_entries ce
            WHERE ce.user_id = :userId
              AND ce.financial_year = :financialYear
              AND ce.cash_date::date = :entryDate
              AND (
                ce.narration LIKE 'Aggregated % for %'
                OR ce.narration LIKE 'CASH entry for % for %'
             )
             `, {
            replacements: {
              userId: row_data.user_id,
              financialYear: row_data.financial_year,
              entryDate: row_data.entry_date
            },
            transaction: t
          });

          // Group cash_sales by invoice_seq_id
          const groupedByInvoice = {};
          for (const saleObj of row_data.cash_sales || []) {
            const invoiceId = saleObj.cash_sale_entries.invoice_seq_id;
            if (!groupedByInvoice[invoiceId]) groupedByInvoice[invoiceId] = [];
            groupedByInvoice[invoiceId].push(saleObj);
          }

          // Outer loop: per invoice_seq_id group
          for (const [invoiceId, group] of Object.entries(groupedByInvoice)) {
            // 🔹 Fetch next sequence id and sNo for this invoice group
            const [[{ next_sequence_id }]] = await db.sequelize.query(
              `SELECT nextval('group_entries_seq') AS next_sequence_id`,
              { transaction: t }
            );

            const existingTracker = await db.invoice_tracker.findOne({
              where: { user_id: row_data.user_id, financial_year: row_data.financial_year, type: group[0].cash_sale_entries.type },
              transaction: t
            });

            const [updatedTracker] = await db.invoice_tracker.upsert(
              {
                user_id: row_data.user_id,
                financial_year: row_data.financial_year,
                type: group[0].cash_sale_entries.type,
                last_sno: existingTracker ? existingTracker.last_sno + 1 : 1
              },
              {
                transaction: t,
                returning: true,
                conflictFields: ['user_id', 'financial_year', 'type']
              }
            );

            const next_sNo = updatedTracker?.last_sno ?? 1;

            // Inner loop: per saleObj in this invoice group
            for (const saleObj of group) {
              const { cash_sale_entries: sale, cash_entry_fields: fields } = saleObj;

              // Get target_id once
              const auditRows = await db.sequelize.query(`
                SELECT a.target_id
                FROM copy_job_audit a
                JOIN cash_sale_entries c ON a.target_id = c.id
                WHERE a.job_id = :jobId
                  AND a.table_name = 'cash_sale_entries'
                  AND a.source_id = :sourceId
                  AND c.entry_date::date = :entryDate
                  AND c.user_id = :userId
                  AND c.financial_year = :financialYear
              `, {
                replacements: {
                  jobId: latestJobId,
                  sourceId: sale.id,
                  entryDate: row_data.entry_date,
                  userId: row_data.user_id,
                  financialYear: row_data.financial_year
                },
                type: db.Sequelize.QueryTypes.SELECT,
                transaction: t
              });

              const targetIds = auditRows.map(r => r.target_id);

              // Delete old fields + sale entry if any
              if (targetIds.length > 0) {
                await db.cashEntryFields.destroy({ where: { cash_sale_entry_id: targetIds }, transaction: t });
                await db.cashSaleEntries.destroy({ where: { id: targetIds }, transaction: t });
              }

              // Insert new sale
              const { id: sourceSaleId, ...saleRow } = sale;
              saleRow.account_id = CacheTracker.getMapping(jobId, "account_list", saleRow.account_id);
              saleRow.category_account_id = CacheTracker.getMapping(jobId, "account_list", saleRow.category_account_id);
              saleRow.category_id = CacheTracker.getMapping(jobId, "categories", saleRow.category_id);
              saleRow.item_id = CacheTracker.getMapping(jobId, "items", saleRow.item_id);
              saleRow.unit_id = CacheTracker.getMapping(jobId, "units", saleRow.unit_id);
              saleRow.invoice_seq_id = next_sequence_id;
              saleRow.sNo = next_sNo;

              const [saleEntry, createdSale] = await stageHelperService.safeUpsert({
                model: db.cashSaleEntries,
                tableName: "cash_sale_entries",
                row_data: saleRow,
                stageCfg: copyJobConfig.stages.data.stage2d,
                db,
                transaction: t
              });

              // 🔹 Restore chunkMeta handling for sales
              const chunkMetaSale = CacheTracker.getChunkSummary(jobId, "cash_sale_entries", Constants.STAGE_IDS.STAGE2D, chunk_index);
              if (!chunkMetaSale) throw new Error(`Chunk not found for cash_sale_entries and s3_key ${s3_key}`);
              CacheTracker.increment(jobId, "cash_sale_entries", "processed");
              CacheTracker.increment(jobId, "cash_sale_entries", createdSale ? "inserted" : "skipped");
              CacheTracker.incrementChunk(jobId, "cash_sale_entries", chunkMetaSale.s3Key, chunkMetaSale.chunkIndex);

              // Insert fields
              for (const field of fields || []) {
                const { id: sourceFieldId, ...fieldRow } = field;
                fieldRow.cash_sale_entry_id = saleEntry.id;
                fieldRow.field_id = CacheTracker.getMapping(jobId, "fields", fieldRow.field_id);

                const [saleField, createdField] = await stageHelperService.safeUpsert({
                  model: db.cashEntryFields,
                  tableName: "cash_entry_fields",
                  row_data: fieldRow,
                  stageCfg: copyJobConfig.stages.data.stage2d,
                  db,
                  transaction: t
                });

                // 🔹 Restore chunkMeta handling for fields
                const chunkMetaField = CacheTracker.getChunkSummary(jobId, "cash_entry_fields", Constants.STAGE_IDS.STAGE2D, chunk_index);
                if (!chunkMetaField) throw new Error(`Chunk not found for cash_entry_fields and s3_key ${s3_key}`);
                CacheTracker.increment(jobId, "cash_entry_fields", "processed");
                CacheTracker.increment(jobId, "cash_entry_fields", createdField ? "inserted" : "skipped");
                CacheTracker.incrementChunk(jobId, "cash_entry_fields", chunkMetaField.s3Key, chunkMetaField.chunkIndex);
              }

              // Audit entry
              await db.copyJobAudit.create({
                job_id: jobId,
                table_name: "cash_sale_entries",
                source_id: sourceSaleId,
                target_id: saleEntry.id,
                action: createdSale ? Constants.AUDIT_ACTIONS.STAGE2D.INSERT_COPYJOB : Constants.AUDIT_ACTIONS.STAGE2D.SKIP_COPYJOB,
                message: JSON.stringify(saleObj)
              }, { transaction: t });
            }
          }
          console.log(`✅ Stage2d: processed date group ${row_data.entry_date}`);
        } catch (err) {
          console.error(`❌ Failed Stage2d date group ${row_data.entry_date}:`, err.message);
          CacheTracker.increment(jobId, "cash_sale_entries", "failed");
        }
      });

      // Completion check (unchanged)
      try {
        const groupTables = ["cash_sale_entries", "cash_entry_fields"];
        const results = groupTables.map(tbl => {
          const summary = CacheTracker.getSummary(jobId, tbl);
          if (!summary || !summary.total || summary.total === 0) return true;
          const totalChunks = CacheTracker.getTotalChunks(jobId, tbl, Constants.STAGE_IDS.STAGE2D);
          return CacheTracker.isComplete(jobId, tbl, totalChunks);
        });
        const allComplete = results.every(Boolean);

        if (allComplete) {
          for (const tbl of groupTables) {
            const totalChunks = CacheTracker.getTotalChunks(jobId, tbl, Constants.STAGE_IDS.STAGE2D);
            console.log(`🎯 Table ${tbl} reached completion in cache`);
            const tableMeta = await db.copyJobTable.findOne({ where: { job_id: jobId, stage: Constants.STAGE_IDS.STAGE2D, table_name: tbl } });
            if (tableMeta) {
              await stageHelperService.flushTableSummary({ db, jobId, stage: Constants.STAGE_IDS.STAGE2D, tableName: tbl, tableMetaId: tableMeta.id, totalChunks });
              await stageHelperService.finalizeStage({ db, jobId, stageNumber: Constants.STAGE_IDS.STAGE2D });
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error during completion handling for cashSalesByDate group:`, err.message);
      }
    }
  }

  console.log(`🚀 Stage2d processed ${records.length} rows for Job ${jobId}`);
};
