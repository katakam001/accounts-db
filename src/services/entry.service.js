const { getDb } = require("../utils/getDb");

exports.addEntriesService = async (entries) => {

  try {
    const db = getDb();
    const t = await db.sequelize.transaction();
    const Entry = db.entry;
    const EntryField = db.entryField;
    const JournalItem = db.journalItem;
    const JournalEntry = db.journalEntry;

    const invoiceNumber = entries[0].invoiceNumber;
    const journalDate = entries[0].entry_date;
    const userId = entries[0].user_id;
    const financialYear = entries[0].financial_year;
    const type = entries[0].type;

    // Step 1: Get the next sequence ID for the invoice group
    const [[{ next_sequence_id }]] = await db.sequelize.query(
      `SELECT nextval('group_entries_seq') AS next_sequence_id`
    );

    // Step 2: Insert a new journal entry
    const journalEntry = await JournalEntry.create({
      journal_date: journalDate,
      user_id: userId,
      financial_year: financialYear,
      type: type,
      invoiceNumber:invoiceNumber,
      invoice_seq_id: next_sequence_id // Store the sequence ID
    }, { transaction: t });

    const allJournalItems = [];
    let total_amount = 0;

    const updatedEntries = []; // Array to store entries with assigned IDs

    for (const entry of entries) {
      // Remove dynamicFields from entry before creating new Entry
      const { dynamicFields, id,customerName, ...entryWithoutDynamicFields } = entry;

      // Step 2: Insert a new entry with the journal_id
      entryWithoutDynamicFields.journal_id = journalEntry.id;
      entryWithoutDynamicFields.invoice_seq_id = next_sequence_id; // Assign the same sequence ID
      const newEntry = await Entry.create(entryWithoutDynamicFields, { transaction: t });

      const entryFields = dynamicFields.map(field => ({
        entry_id: newEntry.id,
        field_id: field.field_id,
        field_value: field.field_value
      }));
      await EntryField.bulkCreate(entryFields, { transaction: t });

      // Determine the amount based on exclude_from_total and field_category
      const amount = dynamicFields.some(field => field.field_category === 1 && field.exclude_from_total) ? entry.value : entry.total_amount;
      total_amount += parseFloat(amount); // Parse the amount before summation

      // Add new entry with assigned ID to updatedEntries array, keeping dynamicFields the same
      updatedEntries.push({
        ...newEntry.toJSON(),
        dynamicFields: dynamicFields,
      });

      // Step 3: Insert journal items for the entry
      const journalItems = await getJournalItems(entry, dynamicFields, journalEntry.id, amount,customerName);
      allJournalItems.push(...journalItems);
    }

    // Create party journal item once per invoice
    const partyJournalItems = await getPartyJournalItems(entries[0], total_amount, journalEntry.id);
    // Add partyJournalItems to the front of the allJournalItems array
    allJournalItems.unshift(...partyJournalItems);

    // console.log(allJournalItems.length);

    await JournalItem.bulkCreate(allJournalItems, {
      fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt','narration'],
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt','narration'],
      transaction: t
    });

    await t.commit();
    
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
  } catch (error) {
    console.error(error);
    await t.rollback();
    throw new Error('Internal server error');
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
  