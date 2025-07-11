const { getDb } = require("../utils/getDb");
const moment = require('moment-timezone');
const { v5: uuidv5 } = require("uuid");
const invoiceUtils = require('../utils/invoiceUtils');
const entryService = require('../services/entry.service');
const cache = require("../services/cache.service"); // ✅ Import shared cache service

const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // A predefined namespace
exports.loadAccountsWithGroupIds = async ({ userId, financialYear }) => {

    const accountMap = new Map();
    const db = getDb();
    const sqlQuery = `
                SELECT al.id AS account_id, LOWER(al."name") AS account_name, ag.group_id
                FROM account_list al
                JOIN account_group ag ON al.id = ag.account_id
                WHERE al.user_id = :userId AND al.financial_year = :financialYear;
            `;

    const results = await db.sequelize.query(sqlQuery, {
        replacements: { userId, financialYear },
        type: db.Sequelize.QueryTypes.SELECT,
    });

    results.forEach((row) => {
        accountMap.set(row.account_name, { accountId: row.account_id, groupId: row.group_id });
    });

    return accountMap;
};

exports.loadGroupMap = async ({ userId, financialYear }) => {
    const db = getDb();
    const groupMap = new Map();

    // 🔹 Load group IDs for quick lookup
    const groupQuery = `
        SELECT id AS group_id, LOWER(name) AS group_name
        FROM group_list
        WHERE user_id = :userId AND financial_year = :financialYear;
    `;

    const groupResults = await db.sequelize.query(groupQuery, {
        replacements: { userId, financialYear },
        type: db.Sequelize.QueryTypes.SELECT,
    });

    groupResults.forEach(row => {
        groupMap.set(row.group_name, row.group_id);
    });


    return groupMap;
};
exports.loadMappingRuleRecords = async () => {
    try {
        const db = getDb();

        const records = await db.sequelize.query(
            `SELECT source, target, amount_mandatory, type
       FROM mapping_rules
       WHERE statement_type = 0 AND statement_provider = 'lint'`,
            { type: db.sequelize.QueryTypes.SELECT }
        );

        return records;
    } catch (error) {
        console.error('Error fetching mapping rules:', error);
        throw new Error('Could not load mapping_rules from DB');
    }
};

exports.getAccountsByGroup = async ({ group_name, user_id, financial_year }) => {
    try {
        const db = getDb(); // Get Sequelize DB instance
        // console.log(group_name);
        // console.log(user_id);
        // console.log(financial_year);

        const results = await db.sequelize.query(
            `SELECT 
                al.id AS account_id, 
                al.name AS account_name, 
                g.id AS group_id
            FROM 
                account_list AS al
            INNER JOIN 
                account_group AS ag 
            ON 
                al.id = ag.account_id
            INNER JOIN 
                group_list AS g 
            ON 
                ag.group_id = g.id
            WHERE 
                g.name = :group_name
                AND al.user_id = :user_id
                AND al.financial_year = :financial_year;`,
            {
                replacements: { group_name, user_id, financial_year }, // Replace dynamic parameters
                type: db.sequelize.QueryTypes.SELECT, // Query type
            }
        );
        return results;
    } catch (error) {
        console.error('Error fetching accounts:', error);
        throw new Error('Could not retrieve accounts for the group');
    }
};

exports.fetchUnitIdsByCategoryIds = async ({ categoryIds, user_id, financial_year }) => {
    try {
        // console.log(categoryIds);
        const db = getDb(); // Get the database instance
        const query = `
      SELECT category_id, unit_id 
      FROM category_units 
      WHERE category_id IN (:categoryIds)
    `;

        const results = await db.sequelize.query(query, {
            replacements: { categoryIds }, // Pass the category IDs
            type: db.sequelize.QueryTypes.SELECT, // Query type
        });

        // Transform results into a Map for easier access
        const unitIdMap = new Map();
        results.forEach((row) => {
            unitIdMap.set(row.category_id, row.unit_id);
        });

        return unitIdMap; // Map of category_id => unit_id
    } catch (error) {
        console.error('Error fetching unit IDs:', error.message);
        throw new Error('Failed to fetch unit IDs');
    }
};

exports.fetchDynamicFieldsByCategoryIds = async ({ categoryIds, user_id, financial_year }) => {
    try {
        const db = getDb(); // Initialize database instance

        const query = `
      SELECT 
          fm.category_id,
          fm.field_id,
          f.field_name,
          fm.field_type,
          fm.required,
          fm.field_category,
          fm.exclude_from_total,
          fm.account_id AS tax_account_id
      FROM 
          fields_mapping fm
      JOIN 
          fields f
      ON 
          fm.field_id = f.id
      WHERE 
          fm.category_id IN (:categoryIds);
    `;

        const results = await db.sequelize.query(query, {
            replacements: { categoryIds }, // Pass the category IDs dynamically
            type: db.sequelize.QueryTypes.SELECT, // Query type for plain results
        });

        // Group results by category_id for easier access
        const dynamicFieldsMap = new Map();
        results.forEach((field) => {
            if (!dynamicFieldsMap.has(field.category_id)) {
                dynamicFieldsMap.set(field.category_id, []);
            }
            dynamicFieldsMap.get(field.category_id).push({
                field_id: field.field_id,
                field_name: field.field_name,
                field_type: field.field_type,
                required: field.required,
                field_category: field.field_category,
                exclude_from_total: field.exclude_from_total,
                tax_account_id: field.tax_account_id,
            });
        });

        return dynamicFieldsMap; // Map of category_id -> dynamic fields array
    } catch (error) {
        console.error('Error fetching dynamic fields:', error.message);
        throw new Error('Failed to fetch dynamic fields');
    }
};

exports.processOpeningBalance = async ({
    trailBalanceRecords,
    userId,
    financialYear,
    accountMap,
    groupMap,
    groupMappingMap,
    accountMappingMap
}) => {
    const db = getDb();
    const Account = db.account;
    const AccountGroup = db.accountGroup;
    const t = await db.sequelize.transaction();
    // console.log(groupMappingMap);
    // console.log(accountMappingMap);
    // console.log(accountMap);

    try {
        for (const record of trailBalanceRecords) {
            console.log(record);
            const { group_name, account_name, credit_amount, debit_amount, place } = record;

            if (place === '|' && parseFloat(credit_amount || 0) === 0 && parseFloat(debit_amount || 0) === 0) {
                console.log(`⏭️ Skipped account "${account_name}" due to empty balance and placeholder place.`);
                continue;
            }

            const normalizedGroup = group_name.toLowerCase().trim();
            const normalizedAccount = account_name.toLowerCase().trim();

            // 🔍 Resolve group
            const mappedGroupRaw = groupMappingMap.get(normalizedGroup);
            const mappedGroup = mappedGroupRaw?.target || group_name;
            const groupAmountMandatory = mappedGroupRaw?.amount_mandatory ?? true;

            const normalizedMappedGroup = mappedGroup.toLowerCase().trim();
            const groupId = groupMap.get(normalizedMappedGroup);
            if (!groupId) {
                console.warn(` Skipping: groupId not found for "${mappedGroup}"`);
                continue;
            }

            // 🔍 Resolve account
            const mappedAccountRaw = accountMappingMap.get(normalizedAccount);
            const mappedAccount = mappedAccountRaw?.target || account_name;
            const normalizedMappedAccount = mappedAccount.toLowerCase().trim();
            let accountInfo = accountMap.get(normalizedMappedAccount);
            console.log(accountInfo);
            let accountId;

            // ⚙️ Determine balances
            const credit = groupAmountMandatory ? parseFloat(credit_amount || 0) : 0;
            const debit = groupAmountMandatory ? parseFloat(debit_amount || 0) : 0;

            if (accountInfo && accountInfo.groupId === groupId) {
                if (groupAmountMandatory) {
                    accountId = accountInfo.accountId;
                    console.log(accountId);
                    console.log(groupId);
                    await Account.update(
                        { credit_balance: credit, debit_balance: debit },
                        { where: { id: accountId }, transaction: t }
                    );
                    console.log(` Updated existing account: ${mappedAccount}`);
                } else {
                    console.log(` Skipped updating account "${mappedAccount}" due to amount_mandatory = false`);
                    continue;
                }
            } else {
                const groupSuffix = mappedGroup.split(/\s+/).map(w => w[0]).join('').toUpperCase();
                const newAccountName =
                    accountInfo && accountInfo.groupId !== groupId
                        ? `${mappedAccount}-${groupSuffix}`
                        : mappedAccount;
                console.log(groupId);

                const newAccount = await Account.create({
                    name: newAccountName,
                    user_id: userId,
                    financial_year: financialYear,
                    credit_balance: credit,
                    debit_balance: debit
                }, { transaction: t });

                accountId = newAccount.id;
                syncAccountIntoCache({
                    userId,
                    financialYear,
                    accountName: newAccountName,
                    accountId,
                    groupId
                });
                console.log(` Created new account: ${newAccountName}`);
            }

            // 🔐 Link account to group only if the pair doesn't already exist
            const existingMapping = await AccountGroup.findOne({
                where: { account_id: accountId, group_id: groupId }
            });

            if (!existingMapping && accountId) {
                await AccountGroup.create({ account_id: accountId, group_id: groupId }, { transaction: t });
                console.log(`✅ Linked account ${accountId} to group ${groupId}`);
            } else {
                console.log(`ℹ️ AccountGroup mapping already exists for account ${accountId} & group ${groupId}`);
            }

        }

        await t.commit();
        console.log(`✅ Opening balances processed.`);
    } catch (error) {
        await t.rollback();
        console.error(`❌ Error processing opening balances:`, error);
    }
};


function syncAccountIntoCache({ userId, financialYear, accountName, accountId, groupId }) {
  const cacheKey = `${userId}_${financialYear}`;
  const cachedData = cache.getCache(cacheKey) || {};
  cachedData.accountMap = cachedData.accountMap || {};
  const key = accountName.toLowerCase().trim();
  cachedData.accountMap[key] = { accountId, groupId };
  cache.setCache(cacheKey, cachedData);
}

exports.processTransactions = async ({ groupedRecords, accountMap, suspenseAccountName, bankAccount, userId, financialYear }) => {

    const db = getDb(); // Get database instance
    const t = await db.sequelize.transaction(); // Start a transaction
    const checkAmountType = (input) => input.includes('(Cr)') ? true : input.includes('(Dr)') ? false : null;

    try {
        const JournalEntry = db.journalEntry;
        const JournalItem = db.journalItem;
        const CashEntryBatch = db.cashEntriesBatch; // Reference to cash_entries_batch
        const BatchOperations = db.globalBatchOperations; // Reference to the batch tracking table
        const uploadedFileLog = db.uploadedFileLog;

        // Step 1: Mark batch operation as active
        await BatchOperations.upsert({
            user_id: userId,
            financial_year: financialYear,
            is_batch: true,
        }, { transaction: t });

        for (const [transactionId, records] of Object.entries(groupedRecords)) {
            // ✅ Check if transaction was already processed
            if (await isDuplicateEntry(transactionId, userId, financialYear, 0)) {
                console.log(`Duplicate detected for Transaction ID: ${transactionId}, skipping...`);
                continue; // Skip processing
            }
            const journalDate = moment(records[0].Date, 'DD/MM/YYYY').tz('Asia/Kolkata')
                .set({ hour: 5, minute: 30, second: 0 });
            let totalAmount = 0;
            let type;
            let createCashEntry = false;
            const cashEntries = []; // List of cash entries for batch processing
            const journalItems = []; // List of journal items for batch processing

            for (const record of records) {
                const remarks = record.Remarks.toLowerCase();
                const amount = invoiceUtils.extractAmountAndType(record["Amount(Rs.)"]);

                if (remarks.includes("by cash") || remarks.includes("cardless deposit")) {
                    createCashEntry = true;

                    // Prepare a cash entry for batch table
                    cashEntries.push({
                        cash_date: journalDate,
                        narration: record.Remarks,
                        account_id: bankAccount.accountId,
                        group_id: bankAccount.groupId,
                        type: !checkAmountType(record["Amount(Rs.)"]),
                        amount,
                        user_id: userId,
                        financial_year: financialYear,
                        transaction_id: transactionId,
                        is_cash_adjustment: false
                    });
                    cashEntries.push({
                        cash_date: journalDate,
                        narration: bankAccount.account_name,
                        account_id: accountMap.get("cash").accountId,
                        group_id: accountMap.get("cash").groupId,
                        type: checkAmountType(record["Amount(Rs.)"]),
                        amount,
                        user_id: userId,
                        financial_year: financialYear,
                        transaction_id: transactionId,
                        is_cash_adjustment: true
                    });

                    totalAmount += amount; // Keep track of the total
                } else {
                    let matchedAccount = null;
                    if (remarks.includes("charges")) {
                        matchedAccount = "bank charges";
                    } else {
                        for (const accountName of accountMap.keys()) {
                            if (remarks.includes(accountName.toLowerCase())) {
                                matchedAccount = accountName;
                                break;
                            }
                        }
                        type = !checkAmountType(record["Amount(Rs.)"]);
                    }
                    const accountDetails = matchedAccount
                        ? accountMap.get(matchedAccount)
                        : accountMap.get(suspenseAccountName);

                    totalAmount += amount;

                    journalItems.push({
                        journal_id: null,
                        account_id: accountDetails.accountId,
                        narration: record.Remarks,
                        group_id: accountDetails.groupId,
                        amount,
                        type: checkAmountType(record["Amount(Rs.)"]),
                    });
                }
            }

            if (createCashEntry) {
                // Insert cash entries into cash_entries_batch
                await CashEntryBatch.bulkCreate(cashEntries, { transaction: t });
                console.log(`Batch cash entries created for transactionId: ${transactionId}`);
            } else {
                const journalEntry = await JournalEntry.create({
                    journal_date: journalDate,
                    transaction_id: transactionId,
                    user_id: userId,
                    financial_year: financialYear,
                    type: 0,
                }, { transaction: t });

                journalItems.forEach((item) => {
                    item.journal_id = journalEntry.id;
                });

                const cashAccount = accountMap.get(bankAccount.accountName);
                if (cashAccount) {
                    journalItems.push({
                        journal_id: journalEntry.id,
                        account_id: cashAccount.accountId,
                        narration: records[0].Remarks,
                        group_id: cashAccount.groupId,
                        amount: totalAmount,
                        type: type,
                    });
                }

                await JournalItem.bulkCreate(journalItems, {
                    fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt', 'narration'],
                    returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt', 'narration'],
                    transaction: t,
                });

                console.log(`Journal entry and items created for transactionId: ${transactionId}`);
            }
            // ✅ Insert the processed transaction into `uploaded_file_log` to prevent duplicates
            await uploadedFileLog.create({
                hash: generateUniqueId(transactionId, userId, financialYear),
                transaction_id: transactionId,
                user_id: userId,
                financial_year: financialYear,
                type: 0
            }, { transaction: t });
        }

        // Step 2: Mark batch operation as complete
        await BatchOperations.update(
            { is_batch: false },
            { where: { user_id: userId, financial_year: financialYear }, transaction: t }
        );

        console.log("Batch operation completed successfully.");
        await t.commit();
        console.log("All transactions processed successfully.");
    } catch (error) {
        await t.rollback();
        console.error("Error processing transactions:", error);
    }
};


exports.processInvoiceTransactions = async ({ extractedData, categoryAccountMap, accountMap, categoryMap, itemsMap, unitIdMap, dynamicFieldsMap, suspenseAccountName, userId, financialYear, type }) => {
    try {
        // console.log(extractedData);
        // console.log(categoryAccountMap);
        // console.log(categoryMap);
        // console.log(itemsMap);
        // console.log(unitIdMap);
        // console.log(dynamicFieldsMap);
        // console.log(accountMap);


        const entries = []; // Initialize an array to collect all entries across all rows
        extractedData.forEach((row, rowNumber) => {
            // console.log(`Processing row ${rowNumber}:`, row);

            // console.log(`Processed row ${rowNumber}:`, extractedData);
            const rowEntries = invoiceUtils.createEntriesForInvoice(
                row,
                categoryMap,
                itemsMap,
                categoryAccountMap,
                unitIdMap,
                accountMap,
                suspenseAccountName,
                dynamicFieldsMap,
                userId, // userId
                financialYear, // financialYear
                type // type
            );
            entries.push(...rowEntries);

        });

        // Add your logic here to save extractedData to the database

        if (entries.length === 0) {
            console.warn('No valid entries were processed.');
            return;
        }
        // Group entries by invoiceNumber
        const groupedEntries = entries.reduce((map, entry) => {
            if (!map.has(entry.invoiceNumber)) {
                map.set(entry.invoiceNumber, []);
            }
            map.get(entry.invoiceNumber).push(entry);
            return map;
        }, new Map());

        // Process each group of entries by invoiceNumber
        for (const [invoiceNumber, invoiceEntries] of groupedEntries) {
            console.log(`Processing invoice ${invoiceNumber} with ${invoiceEntries.length} entries.`);
            // console.log(`Processing invoice ${invoiceNumber} with ${JSON.stringify(invoiceEntries, null, 2)} entries.`);
            try {
                const db = getDb(); // Get database instance
                const uploadedFileLog = db.uploadedFileLog;
                if (await isDuplicateEntry(invoiceNumber, userId, financialYear, type)) {
                    console.log(`Duplicate detected for Invoice Number: ${invoiceNumber}, skipping...`);
                    continue; // Skip processing
                }
                const items = await entryService.addEntriesService(invoiceEntries); // Process each group
                await uploadedFileLog.create({
                    hash: generateUniqueId(invoiceNumber, userId, financialYear),
                    transaction_id: invoiceNumber,
                    user_id: userId,
                    financial_year: financialYear,
                    type: type
                });
                console.log(`Invoice ${invoiceNumber} processed successfully:`, items);

            } catch (error) {
                console.error(error);
                throw new Error('Internal server error');
            }
        }

    } catch (error) {
        console.error("Error processing Excel file:", error);
    }
};

const generateUniqueId = (transactionId, userId, financialYear) => {
    return uuidv5(`${transactionId}-${userId}-${financialYear}`, NAMESPACE);
};

const isDuplicateEntry = async (transactionId, userId, financialYear, type) => {
    const db = getDb();
    const uploadedFileLog = db.uploadedFileLog;
    const uniqueId = generateUniqueId(transactionId, userId, financialYear, type);

    // Check if the unique ID already exists
    const result = await uploadedFileLog.findOne({
        where: { hash: uniqueId }
    });

    return result !== null; // If exists, it's a duplicate
};