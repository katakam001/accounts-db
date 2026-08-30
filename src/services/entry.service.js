const { getDb } = require("../utils/getDb");

exports.addEntriesService = async (entries, transaction) => {
  const db = getDb();
  const Entry = db.entry;
  const EntryField = db.entryField;
  const JournalItem = db.journalItem;
  const JournalEntry = db.journalEntry;
  const InvoiceTracker = db.invoice_tracker;

  const invoiceNumber = entries[0].invoiceNumber;
  const journalDate = entries[0].entry_date;
  const userId = entries[0].user_id;
  const financialYear = entries[0].financial_year;
  const type = entries[0].type;
  let next_seq_no = entries[0].s_no;

  const [[{ next_sequence_id }]] = await db.sequelize.query(
    `SELECT nextval('group_entries_seq') AS next_sequence_id`
  );

  const existingTracker = await InvoiceTracker.findOne({
    where: { user_id: userId, financial_year: financialYear, type },
    transaction
  });

  const [updatedTracker] = await InvoiceTracker.upsert(
    {
      user_id: userId,
      financial_year: financialYear,
      type,
      last_sno: existingTracker ? existingTracker.last_sno + 1 : 1
    },
    {
      transaction,
      returning: true,
      conflictFields: ['user_id', 'financial_year', 'type'],
    }
  );

  if (!next_seq_no) {
    next_seq_no = updatedTracker?.last_sno ?? 1;
  }

  const journalEntry = await JournalEntry.create({
    journal_date: journalDate,
    user_id: userId,
    financial_year: financialYear,
    type,
    invoiceNumber,
    invoice_seq_id: next_sequence_id
  }, { transaction });

  const allJournalItems = [];
  let total_amount = 0;
  const updatedEntries = [];

  for (const entry of entries) {
    const { dynamicFields, id, customerName, ...entryWithoutDynamicFields } = entry;

    entryWithoutDynamicFields.journal_id = journalEntry.id;
    entryWithoutDynamicFields.invoice_seq_id = next_sequence_id;
    entryWithoutDynamicFields.sNo = next_seq_no;

    const newEntry = await Entry.create(entryWithoutDynamicFields, { transaction });

    const entryFields = dynamicFields.map(field => ({
      entry_id: newEntry.id,
      field_id: field.field_id,
      field_value: field.field_value
    }));
    await EntryField.bulkCreate(entryFields, { transaction });

    const amount = dynamicFields.some(field => field.field_category === 1 && field.exclude_from_total)
      ? entry.value
      : entry.total_amount;

    total_amount += parseFloat(amount);

    updatedEntries.push({
      ...newEntry.toJSON(),
      dynamicFields
    });

    const journalItems = await getJournalItems(entry, dynamicFields, journalEntry.id, amount, customerName);
    allJournalItems.push(...journalItems);
  }

  const partyJournalItems = await getPartyJournalItems(entries[0], total_amount, journalEntry.id);
  allJournalItems.unshift(...partyJournalItems);

  await JournalItem.bulkCreate(allJournalItems, {
    fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt', 'narration'],
    returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt', 'narration'],
    transaction
  });

  return {
    message: 'Entries created successfully',
    data: {
      entries: updatedEntries,
      group: { type },
      journalEntry: {
        id: journalEntry.id,
        journal_date: journalEntry.journal_date,
        type: journalEntry.type,
        items: allJournalItems,
      },
      invoiceNumber,
      invoice_seq_id: next_sequence_id,
    },
  };
};


exports.addCashEntriesService = async (entries, transaction) => {
  const db = getDb();
  const CashSaleEntry = db.cashSaleEntries;
  const CashEntryField = db.cashEntryFields;
  const InvoiceTracker = db.invoice_tracker;

  const invoiceNumber = entries[0].invoiceNumber;
  const userId = entries[0].user_id;
  const financialYear = entries[0].financial_year;
  const type = entries[0].type;
  let next_seq_no = entries[0].sNo;

  const [[{ next_sequence_id }]] = await db.sequelize.query(
    `SELECT nextval('group_entries_seq') AS next_sequence_id`,
    { transaction }
  );

  const existingTracker = await InvoiceTracker.findOne({
    where: { user_id: userId, financial_year: financialYear, type },
    transaction
  });

  const [updatedTracker] = await InvoiceTracker.upsert(
    {
      user_id: userId,
      financial_year: financialYear,
      type,
      last_sno: existingTracker ? existingTracker.last_sno + 1 : 1
    },
    {
      transaction,
      returning: true,
      conflictFields: ['user_id', 'financial_year', 'type']
    }
  );

  if (!next_seq_no) {
    next_seq_no = updatedTracker?.last_sno ?? 1;
  }

  const updatedEntries = [];

  for (const entry of entries) {
    const { dynamicFields, id, customerName, ...entryData } = entry;

    entryData.invoice_seq_id = next_sequence_id;
    entryData.sNo = next_seq_no;

    const newEntry = await CashSaleEntry.create(entryData, { transaction });

    const entryFields = dynamicFields.map(field => ({
      cash_sale_entry_id: newEntry.id,
      field_id: field.field_id,
      field_value: field.field_value
    }));

    await CashEntryField.bulkCreate(entryFields, { transaction });

    updatedEntries.push({
      ...newEntry.toJSON(),
      dynamicFields
    });
  }

  return {
    message: 'Cash Entries created successfully',
    data: {
      entries: updatedEntries,
      group: { type },
      invoiceNumber,
      invoice_seq_id: next_sequence_id
    }
  };
};

exports.processCashEntryLedgerService = async (entries, transaction) => {
  const db = getDb();

  const DailySummary = db.dailyCashEntrySummary;
  const CashSaleEntryLink = db.cashSaleEntryLinks;
  const CashEntries = db.cash;
  const Account = db.account;
  const Group = db.group;
  const { user_id, financial_year } = entries[0];
  const summaryMap = new Map();
  const entryLinks = [];

  // 🔹 Fetch CASH account and group
  const cashAccount = await Account.findOne({
    where: { name: 'CASH', user_id, financial_year },
    include: [{ model: Group, as: 'group', through: { attributes: [] } }],
    transaction
  });
  if (!cashAccount || !cashAccount.group?.length) throw new Error('CASH account not found');

  const cash_account_id = cashAccount.id;
  const cash_group_id = cashAccount.group[0].id;

  // 🔹 Aggregate values
  for (const entry of entries) {
    const entryDate = entry.entry_date;
    const saleValue = parseFloat(entry.value);
    const saleAccountId = entry.category_account_id;

    const saleKey = `${entryDate}_${saleAccountId}`;
    summaryMap.set(saleKey, (summaryMap.get(saleKey) || 0) + saleValue);
    entryLinks.push({ entryId: entry.id, accountId: saleAccountId, entryDate });

    for (const field of entry.dynamicFields || []) {
      const accountId = field.tax_account_id;
      const taxValue = parseFloat(field.field_value);
      if (!accountId) continue;

      const taxKey = `${entryDate}_${accountId}`;
      summaryMap.set(taxKey, (summaryMap.get(taxKey) || 0) + taxValue);
      entryLinks.push({ entryId: entry.id, accountId, entryDate });
    }
  }

  // 🔹 Process each summary
  for (const [key, total_amount] of summaryMap.entries()) {
    const [entry_date, account_id] = key.split('_');
    const dateOnly = new Date(entry_date).toISOString().split('T')[0];
    const transaction_id = `TXN-${dateOnly}-${account_id}`;
    const amount = parseFloat(total_amount.toFixed(2));

    // 🔹 Update or insert summary
    const existingSummary = await DailySummary.findOne({
      where: { entry_date: dateOnly, account_id },
      transaction
    });

    let summary;
    if (existingSummary) {
      existingSummary.total_amount = parseFloat(existingSummary.total_amount) + amount;
      summary = await existingSummary.save({ transaction });
    } else {
      summary = await DailySummary.create({
        entry_date: dateOnly,
        account_id,
        total_amount: amount,
        user_id: user_id,
        financial_year: financial_year
      }, { transaction });
    }

    // 🔹 Link entries
    for (const link of entryLinks) {
      const linkDateOnly = new Date(link.entryDate).toISOString().split('T')[0];

      if (link.accountId === parseInt(account_id) && linkDateOnly === dateOnly) {
        await CashSaleEntryLink.findOrCreate({
          where: {
            cash_sale_entry_id: link.entryId,
            summary_id: summary.id
          },
          transaction
        });
      }
    }

    // 🔹 Get group_id for actual account
    const account = await Account.findOne({
      where: { id: parseInt(account_id), user_id, financial_year },
      include: [{ model: Group, as: 'group', through: { attributes: [] } }],
      transaction
    });
    if (!account || !account.group?.length) throw new Error('account not found');

    const group_id = account.group[0].id;
    const account_name = account.name;
    if (!group_id) continue;

    // 🔹 Main entry: update or insert
    const existingMainEntry = await CashEntries.findOne({
      where: {
        transaction_id,
        user_id,
        financial_year,
        is_cash_adjustment: false
      },
      transaction
    });

    if (existingMainEntry) {
      existingMainEntry.amount = parseFloat(existingMainEntry.amount) + amount;
      existingMainEntry.narration = `Aggregated ${account_name} for ${dateOnly}`;
      await existingMainEntry.save({ transaction });
    } else {
      await CashEntries.create({
        cash_date: entry_date,
        narration: `Aggregated ${account_name} for ${dateOnly}`,
        account_id: parseInt(account_id),
        type: true,
        amount,
        user_id,
        financial_year,
        transaction_id,
        is_cash_adjustment: false,
        group_id
      }, { transaction });
    }

    // 🔹 Mirror CASH entry: update or insert
    const existingCashEntry = await CashEntries.findOne({
      where: {
        transaction_id,
        user_id,
        financial_year,
        is_cash_adjustment: true
      },
      transaction
    });

    if (existingCashEntry) {
      existingCashEntry.amount = parseFloat(existingCashEntry.amount) + amount;
      existingCashEntry.narration = `CASH entry for ${account_name} for ${dateOnly}`;
      await existingCashEntry.save({ transaction });
    } else {
      await CashEntries.create({
        cash_date: entry_date,
        narration: `CASH entry for ${account_name} for ${dateOnly}`,
        account_id: cash_account_id,
        type: false,
        amount,
        user_id,
        financial_year,
        transaction_id,
        is_cash_adjustment: true,
        group_id: cash_group_id
      }, { transaction });
    }
  }

  return { message: 'Cash entry ledger processed successfully' };
};

exports.runCashSalesLedgerJob = async (user_id, financial_year, transaction = null) => {
  const db = getDb();
  const sequelize = db.sequelize;
  try {
    await sequelize.query(
      `CALL process_cash_sales_to_entries(:user_id, :financial_year)`,
      {
        replacements: { user_id, financial_year },
        transaction
      }
    );
    return { success: true, message: 'Ledger job executed successfully' };
  } catch (error) {
    console.error('Ledger job failed:', error.message);
    throw new Error('Failed to execute ledger job');
  }
};

async function getGroupIdFromAccountId(accountId, userId, financialYear) {
  const db = getDb();
  const Account = db.account;
  const AccountGroup = db.accountGroup;
  const account = await Account.findOne({ where: { id: accountId, user_id: userId, financial_year: financialYear } });
  if (account) {
    const accountGroup = await AccountGroup.findOne({ where: { account_id: account.id } });
    return accountGroup ? accountGroup.group_id : null;
  }
  return null;
}

const getDescription = (type, isUpdate = false) => {
  const descriptions = {
    1: isUpdate ? 'Purchase Update' : 'Purchase Entry',
    2: isUpdate ? 'Sale Update' : 'Sale Entry',
    3: isUpdate ? 'Purchase Return Update' : 'Purchase Return',
    4: isUpdate ? 'Sale Return Update' : 'Sale Return',
    5: isUpdate ? 'Credit Note Update' : 'Credit Note',
    6: isUpdate ? 'Debit Note Update' : 'Debit Note'
  };
  return descriptions[type] || '';
};

const getJournalItems = async (entry, dynamicFields, journalId, amount, customerName) => {
  const journalItems = [];

  // Pass the narration for getJournalItems
  const narration = `${customerName} i.no.${entry.invoiceNumber} qty.${entry.quantity}`;
  journalItems.push(await createJournalItem(journalId, entry.category_account_id, entry.value, entry.type === 1 || entry.type === 4 || entry.type === 6 ? false : true, entry.user_id, entry.financial_year, narration));

  for (const field of dynamicFields) {
    if (field.field_category === 1) {
      const groupId = await getGroupIdFromAccountId(field.tax_account_id, entry.user_id, entry.financial_year);
      const type = entry.type === 1 || entry.type === 4 || entry.type === 6 ? field.exclude_from_total : !field.exclude_from_total;

      // Use the same dynamic narration format for this entry
      journalItems.push({
        journal_id: journalId,
        account_id: field.tax_account_id,
        group_id: groupId,
        amount: parseFloat(parseFloat(field.field_value).toFixed(2)), // Convert amount to float and fix to 2 decimals
        type: type,
        narration: `${customerName} i.no.${entry.invoiceNumber} qty.${entry.quantity}`
      });
    }
  }

  return journalItems;
};

const getPartyJournalItems = async (entry, total_amount, journalId) => {
  const journalItems = [];

  // Pass the narration for getPartyJournalItems
  const narration = `i.no.${entry.invoiceNumber}/qty.${entry.quantity}`;
  switch (entry.type) {
    case 1: // Purchase Entry
    case 6: // Debit Note
    case 4: // Sale Return
      journalItems.push(await createJournalItem(journalId, entry.account_id, total_amount, true, entry.user_id, entry.financial_year, narration));
      break;
    case 2: // Sale Entry
    case 3: // Purchase Return
    case 5: // Credit Note
      journalItems.push(await createJournalItem(journalId, entry.account_id, total_amount, false, entry.user_id, entry.financial_year, narration));
      break;
  }

  return journalItems;
};

const createJournalItem = async (journalId, accountId, amount, type, userId, financialYear, narration) => {
  return {
    journal_id: journalId,
    account_id: accountId,
    group_id: await getGroupIdFromAccountId(accountId, userId, financialYear),
    amount: parseFloat(parseFloat(amount).toFixed(2)), // Convert amount to float and fix to 2 decimals
    type: type,
    narration: narration // Add narration dynamically
  };
};
