const {getDb} = require("../utils/getDb");
const { broadcast } = require('../websocket'); // Import the broadcast function


exports.getEntries = async (req, res) => {
  const user_id = req.query.userId;
  const financial_year = req.query.financialYear;
  const type = req.query.type; // Add type parameter

  if (!user_id) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }
  if (!financial_year) {
    return res.status(400).json({ error: 'financialYear query parameter is required' });
  }
  if (!type) {
    return res.status(400).json({ error: 'type query parameter is required' });
  }

  try {
    const db = getDb();
    const Entry = db.entry;
    const EntryField = db.entryField;
    const entries = await Entry.findAll({
      where: {
        user_id,
        financial_year,
        type // Include type in the WHERE clause
      },
      attributes: [
        'id',
        'category_id',
        'entry_date',
        'account_id',
        'item_id', // Change to item_id
        'quantity',
        'unit_price',
        'total_amount',
        'user_id',
        'financial_year',
        'value',
        'journal_id',
        'type',
        'unit_id'
      ],
      include: [
        {
          model: EntryField,
          as: 'fields',
          attributes: [
            'field_id',
            'field_value'
          ]
        }
      ]
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getEntryById = async (req, res) => {
  const entryId = req.params.id;

  if (!entryId) {
    return res.status(400).json({ error: 'Entry ID parameter is required' });
  }

  try {
    const db = getDb();
    const Entry = db.entry;
    const EntryField = db.entryField;
    const Categories = db.categories;
    const Account = db.account;
    const Units = db.units;
    const Fields = db.fields;
    const Items = db.items;

    const entry = await Entry.findOne({
      where: {
        id: entryId
      },
      attributes: [
        'id',
        'category_id',
        'entry_date',
        'account_id',
        'item_id',
        'quantity',
        'unit_price',
        'total_amount',
        'user_id',
        'financial_year',
        'value',
        'journal_id',
        'type',
        [db.sequelize.col('category.name'), 'category_name'],
        [db.sequelize.col('account.name'), 'account_name'],
        [db.sequelize.col('unit.name'), 'unit_name'],
        [db.sequelize.col('unit.id'), 'unit_id'],
        [db.sequelize.col('item.name'), 'item_name']
      ],
      include: [
        {
          model: EntryField,
          as: 'fields',
          attributes: [
            'id',
            'entry_id',
            'field_id',
            'field_value',
            [db.sequelize.literal('"fields->field"."field_name"'), 'field_name']
          ],
          include: [
            {
              model: Fields,
              as: 'field',
              attributes: []
            }
          ]
        },
        {
          model: Categories,
          as: 'category',
          attributes: []
        },
        {
          model: Account,
          as: 'account',
          attributes: []
        },
        {
          model: Units,
          as: 'unit',
          attributes: []
        },
        {
          model: Items,
          as: 'item',
          attributes: []
        }
      ]
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addEntry = async (req, res) => {
  const { entry, dynamicFields } = req.body;

  try {
    const db = getDb();
    const t = await db.sequelize.transaction();
    const Entry = db.entry;
    const EntryField = db.entryField;
    const JournalItem = db.journalItem;
    const JournalEntry = db.journalEntry;

    // Step 1: Insert a new journal entry
    const journalEntry = await JournalEntry.create({
      journal_date: entry.entry_date,
      description: getDescription(entry.type),
      user_id: entry.user_id,
      financial_year: entry.financial_year,
      type: entry.type
    }, { transaction: t });

    // Step 2: Insert a new entry with the journal_id
    entry.journal_id = journalEntry.id;
    const newEntry = await Entry.create(entry, { transaction: t });
    const entryFields = dynamicFields.map(field => ({
      entry_id: newEntry.id,
      field_id: field.field_id,
      field_value: field.field_value
    }));
    await EntryField.bulkCreate(entryFields, { transaction: t });

    // Determine the amount based on exclude_from_total and field_category
    const amount = dynamicFields.some(field => field.field_category === 1 && field.exclude_from_total) ? entry.value : entry.total_amount;

    // Step 3: Insert journal items for the entry
    const journalItems = await getJournalItems(entry, dynamicFields, journalEntry.id, amount);

    await JournalItem.bulkCreate(journalItems, {
      fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
      transaction: t
    });
    const fullEntry = await fetchFullEntry(newEntry.id,t);
    await t.commit();


    // Fetch additional attributes for the new entry

    // Broadcast the new entry along with journal entries and items (excluding entryFields)
    const broadcastData = {
      entry: fullEntry,
      journalEntry: {
        id: journalEntry.id,
        journal_date: journalEntry.journal_date,
        description: journalEntry.description,
        type: journalEntry.type,
        items: journalItems
      }
    };

    broadcast({ type: 'INSERT', data: broadcastData, entryType: 'entry', user_id: entry.user_id, financial_year: entry.financial_year });

    res.status(201).json({ message: 'Entry created successfully' }); // Simplified response
  } catch (error) {
    console.log(error);
    await t.rollback();
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Helper functions to get account and group IDs
async function getAccountId(accountName, userId, financialYear) {
  const db = getDb();
  const Account = db.account;
  const account = await Account.findOne({ where: { name: accountName, user_id: userId, financial_year: financialYear } });
  return account ? account.id : null;
}

async function getGroupIdFromAccountName(accountName, userId, financialYear) {
  const db = getDb();
  const Account = db.account;
  const AccountGroup = db.accountGroup;
  const account = await Account.findOne({ where: { name: accountName, user_id: userId, financial_year: financialYear } });
  if (account) {
    const accountGroup = await AccountGroup.findOne({ where: { account_id: account.id } });
    return accountGroup ? accountGroup.group_id : null;
  }
  return null;
}

// Helper function to get group ID by group name
async function getGroupId(groupName, userId, financialYear) {
  const db = getDb();
  const Group = db.group;
  const group = await Group.findOne({ where: { name: groupName, user_id: userId, financial_year: financialYear } });
  return group ? group.id : null;
}

const getDescription = (type, isUpdate = false) => {
  switch (type) {
    case 1: return isUpdate ? 'Purchase Update' : 'Purchase Entry';
    case 2: return isUpdate ? 'Sale Update' : 'Sale Entry';
    case 3: return isUpdate ? 'Purchase Return Update' : 'Purchase Return';
    case 4: return isUpdate ? 'Sale Return Update' : 'Sale Return';
    case 5: return isUpdate ? 'Credit Note Update' : 'Credit Note';
    case 6: return isUpdate ? 'Debit Note Update' : 'Debit Note';
    default: return '';
  }
};

const getJournalItems = async (entry, dynamicFields, journalId, amount) => {
  const journalItems = [];

  switch (entry.type) {
    case 1: // Purchase Entry
      journalItems.push(await createJournalItem(journalId, entry.account_id, 'Sundary Creditors', amount, true, entry.user_id, entry.financial_year));
      journalItems.push(await createJournalItemWithAccountId(journalId, 'Purchase Account', 'Purchase Account', entry.value, false, entry.user_id, entry.financial_year));
      break;
    case 2: // Sale Entry
      journalItems.push(await createJournalItem(journalId, entry.account_id, 'Sundary Debtors', amount, false, entry.user_id, entry.financial_year));
      journalItems.push(await createJournalItemWithAccountId(journalId, 'Sales Account', 'Sales Account', entry.value, true, entry.user_id, entry.financial_year));
      break;
    case 3: // Purchase Return
      journalItems.push(await createJournalItem(journalId, entry.account_id, 'Sundary Creditors', amount, false, entry.user_id, entry.financial_year));
      journalItems.push(await createJournalItemWithAccountId(journalId, 'Purchase Account', 'Purchase Account', entry.value, true, entry.user_id, entry.financial_year));
      break;
    case 4: // Sale Return
      journalItems.push(await createJournalItem(journalId, entry.account_id, 'Sundary Debtors', amount, true, entry.user_id, entry.financial_year));
      journalItems.push(await createJournalItemWithAccountId(journalId, 'Sales Account', 'Sales Account', entry.value, false, entry.user_id, entry.financial_year));
      break;
    case 5: // Credit Note
      journalItems.push(await createJournalItem(journalId, entry.account_id, 'Sundary Creditors', amount, false, entry.user_id, entry.financial_year));
      journalItems.push(await createJournalItemWithAccountId(journalId, 'Discount Received', 'Discount Received', entry.value, true, entry.user_id, entry.financial_year));
      break;
    case 6: // Debit Note
      journalItems.push(await createJournalItem(journalId, entry.account_id, 'Sundary Creditors', amount, true, entry.user_id, entry.financial_year));
      journalItems.push(await createJournalItemWithAccountId(journalId, 'Discount Paid', 'Discount Paid', entry.value, false, entry.user_id, entry.financial_year));
      break;
  }

  // Other entries based on dynamic fields
  for (const field of dynamicFields) {
    if (field.field_category === 1) {
      const accountName = cleanAccountName(field.field_name);
      const groupId = await getGroupIdFromAccountName(accountName, entry.user_id, entry.financial_year);
      const type = entry.type === 1 || entry.type === 4 || entry.type === 6 ? field.exclude_from_total : !field.exclude_from_total;
      journalItems.push({
        journal_id: journalId,
        account_id: await getAccountId(accountName, entry.user_id, entry.financial_year),
        group_id: groupId,
        amount: field.field_value,
        type: type
      });
    }
  }

  return journalItems;
};

const createJournalItem = async (journalId, accountId, groupName, amount, type, userId, financialYear) => {
  return {
    journal_id: journalId,
    account_id: accountId,
    group_id: await getGroupId(groupName, userId, financialYear),
    amount: amount,
    type: type
  };
};

const createJournalItemWithAccountId = async (journalId, accountName, groupName, amount, type, userId, financialYear) => {
  return {
    journal_id: journalId,
    account_id: await getAccountId(accountName, userId, financialYear),
    group_id: await getGroupIdFromAccountName(groupName, userId, financialYear),
    amount: amount,
    type: type
  };
};

const cleanAccountName = (name) => {
  return name.replace(/[0-9%]/g, '').trim()
             .replace(/\s+/g, ' ')
             .replace(/^\.+|\.+$/g, '')
             .replace(/RCM\s+/g, 'RCM ')
             .replace(/\s+\./g, '')
             .replace(/\.\s+/g, '')
             .replace(/^\s+|\s+$/g, '');
};

exports.updateEntry = async (req, res) => {
  const { id } = req.params;
  const { entry, dynamicFields } = req.body;

  try {
    const db = getDb();
    const t = await db.sequelize.transaction();
    const Entry = db.entry;
    const EntryField = db.entryField;
    const JournalItem = db.journalItem;
    const JournalEntry = db.journalEntry;

    // Step 1: Update the entry
    await Entry.update(entry, { where: { id }, transaction: t });
    await EntryField.destroy({ where: { entry_id: id }, transaction: t });
    const entryFields = dynamicFields.map(field => ({
      entry_id: id,
      field_id: field.field_id,
      field_value: field.field_value
    }));
    await EntryField.bulkCreate(entryFields, { transaction: t });
    let journalItemsUpdate;
    // Determine the amount based on exclude_from_total and field_category
    const amount = dynamicFields.some(field => field.field_category === 1 && field.exclude_from_total) ? entry.value : entry.total_amount;

    // Step 2: Update the journal entry
    const journalEntryExist = await JournalEntry.findOne({ where: { id: entry.journal_id }, transaction: t });
    if (journalEntryExist) {
      await journalEntryExist.update({
        journal_date: entry.entry_date,
        description: getDescription(entry.type, true),
        user_id: entry.user_id,
        financial_year: entry.financial_year,
        type:entry.type
      }, { transaction: t });

      // Step 3: Delete existing journal items
      await JournalItem.destroy({ where: { journal_id: journalEntryExist.id }, transaction: t });

      // Step 4: Insert new journal items
      journalItemsUpdate = await getJournalItems(entry, dynamicFields, journalEntryExist.id, amount);

      console.log(journalItemsUpdate);

      await JournalItem.bulkCreate(journalItemsUpdate, {
        fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
        returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
        transaction: t
      });
    }
    const fullEntry = await fetchFullEntry(id,t);

    await t.commit();

    // Broadcast the updated entry along with journal entries, items, and dynamic fields
    const broadcastData = {
      entry: fullEntry,
      journalEntry: {
        id: journalEntryExist.id,
        journal_date: journalEntryExist.journal_date,
        description: journalEntryExist.description,
        type: journalEntryExist.type,
        items: journalItemsUpdate
      }
    };
    broadcast({ type: 'UPDATE', data: broadcastData, entryType: 'entry', user_id: entry.user_id, financial_year: entry.financial_year });

    res.status(200).json({ message: 'Entry updated successfully' }); // Simplified response
  } catch (error) {
    console.log(error);
    await t.rollback();
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteEntry = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const t = await db.sequelize.transaction();
    const Entry = db.entry;
    const EntryField = db.entryField;
    const JournalItem = db.journalItem;
    const JournalEntry = db.journalEntry;

    // Find the entry to get the journal_id and type
    const entry = await Entry.findOne({ where: { id }, transaction: t });
    if (entry) {
      const journalId = entry.journal_id;
      const entryType = entry.type; // Optional: Check the entry type

      // Optional: Validate entry type if needed
      if (![1, 2, 3, 4, 5, 6].includes(entryType)) {
        throw new Error('Invalid entry type');
      }

      // Delete the entry fields
      await EntryField.destroy({ where: { entry_id: id }, transaction: t });

      // Delete the entry
      await Entry.destroy({ where: { id }, transaction: t });

      // Delete the journal items
      await JournalItem.destroy({ where: { journal_id: journalId }, transaction: t });

      // Delete the journal entry
      await JournalEntry.destroy({ where: { id: journalId }, transaction: t });
    }

    await t.commit();

    const broadcastData = {
      entry: { id:entry.id,type:entry.type,journal_id:entry.journal_id },
    };

    // Broadcast the deletion event
    broadcast({ type: 'DELETE', data: broadcastData, entryType: 'entry', user_id: entry.user_id, financial_year: entry.financial_year });

    res.status(204).send(); // Simplified response
  } catch (error) {
    console.log(error);
    await t.rollback();
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function fetchFullEntry(entryId, transaction) {
  const db = getDb();
  const Entry = db.entry;
  const EntryField = db.entryField;

  return await Entry.findOne({
    where: { id: entryId },
    attributes: [
      'id',
      'category_id',
      'entry_date',
      'account_id',
      'item_id',
      'quantity',
      'unit_price',
      'total_amount',
      'user_id',
      'financial_year',
      'value',
      'journal_id',
      'type',
      'unit_id'
    ],
    include: [
      {
        model: EntryField,
        as: 'fields',
        attributes: [
          'field_id',
          'field_value',
        ]
      }
    ],
    transaction: transaction
  });
}
