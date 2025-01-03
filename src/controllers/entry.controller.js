const {getDb} = require("../utils/getDb");

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
    const Categories = db.categories;
    const Account = db.account;
    const Units = db.units;
    const Fields = db.fields; // Add this line
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
        'item_description',
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
        [db.sequelize.col('unit.id'), 'unit_id']
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
        }
      ]
    });
    res.json(entries);
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
      description: entry.type === 1 ? 'Purchase Entry' : entry.type === 2 ? 'Sale Entry' : entry.type === 3 ? 'Purchase Return' : 'Sale Return', // Description based on type
      user_id: entry.user_id,
      financial_year: entry.financial_year
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
    let amount = entry.total_amount;
    if (dynamicFields.some(field => field.field_category === 1 && field.exclude_from_total)) {
      amount = entry.value;
    }

    // Step 3: Insert journal items for the entry
    const journalItems = [];

    if (entry.type === 1) { // Purchase Entry
      // First entry: Supplier Account (Credit)
      journalItems.push({
        journal_id: journalEntry.id,
        account_id: entry.account_id,
        group_id: await getGroupId('Sundary Creditors'),
        amount: amount,
        type: true // Credit
      });

      // Second entry: Purchase Account (Debit)
      journalItems.push({
        journal_id: journalEntry.id,
        account_id: await getAccountId('Purchase Account'),
        group_id: await getGroupIdFromAccountName('Purchase Account'),
        amount: entry.value,
        type: false // Debit
      });
    } else if (entry.type === 2) { // Sale Entry
      // First entry: Customer Account (Debit)
      journalItems.push({
        journal_id: journalEntry.id,
        account_id: entry.account_id,
        group_id: await getGroupId('Sundary Debtors'),
        amount: amount,
        type: false // Debit
      });

      // Second entry: Sales Account (Credit)
      journalItems.push({
        journal_id: journalEntry.id,
        account_id: await getAccountId('Sales Account'),
        group_id: await getGroupIdFromAccountName('Sales Account'),
        amount: entry.value,
        type: true // Credit
      });
    } else if (entry.type === 3) { // Purchase Return
      // First entry: Supplier Account (Debit)
      journalItems.push({
        journal_id: journalEntry.id,
        account_id: entry.account_id,
        group_id: await getGroupId('Sundary Creditors'),
        amount: amount,
        type: false // Debit
      });

      // Second entry: Purchase Account (Credit)
      journalItems.push({
        journal_id: journalEntry.id,
        account_id: await getAccountId('Purchase Account'),
        group_id: await getGroupIdFromAccountName('Purchase Account'),
        amount: entry.value,
        type: true // Credit
      });
    } else if (entry.type === 4) { // Sale Return
      // First entry: Customer Account (Credit)
      journalItems.push({
        journal_id: journalEntry.id,
        account_id: entry.account_id,
        group_id: await getGroupId('Sundary Debtors'),
        amount: amount,
        type: true // Credit
      });

      // Second entry: Sales Account (Debit)
      journalItems.push({
        journal_id: journalEntry.id,
        account_id: await getAccountId('Sales Account'),
        group_id: await getGroupIdFromAccountName('Sales Account'),
        amount: entry.value,
        type: false // Debit
      });
    }

    // Other entries based on dynamic fields
    for (const field of dynamicFields) {
      if (field.field_category === 1) {
        let accountName = field.field_name.replace(/[0-9%]/g, '').trim();
        accountName = accountName.replace(/\s+/g, ' '); // Remove extra spaces
        accountName = accountName.replace(/^\.+|\.+$/g, ''); // Remove leading and trailing periods
        accountName = accountName.replace(/RCM\s+/g, 'RCM '); // Handle "RCM 2.5% SGST" -> "RCM SGST"
        accountName = accountName.replace(/\s+\./g, ''); // Remove spaces before periods
        accountName = accountName.replace(/\.\s+/g, ''); // Remove periods before spaces
        accountName = accountName.replace(/^\s+|\s+$/g, ''); // Remove leading and trailing spaces
        console.log(accountName);
        const groupId = await getGroupIdFromAccountName(accountName);
        const type = entry.type === 1 || entry.type === 4 ? (field.exclude_from_total ? true : false) : (field.exclude_from_total ? false : true); // Adjust type based on entry type
        journalItems.push({
          journal_id: journalEntry.id,
          account_id: await getAccountId(accountName),
          group_id: groupId,
          amount: field.field_value,
          type: type
        });
      }
    }

    await JournalItem.bulkCreate(journalItems, {
      fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
      transaction: t
    });

    await t.commit();
    res.status(201).json(newEntry);
  } catch (error) {
    console.log(error);
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};



// Helper functions to get account and group IDs
async function getAccountId(accountName) {
  const db = getDb();
  const Account = db.account;
  const account = await Account.findOne({ where: { name: accountName } });
  return account ? account.id : null;
}

async function getGroupIdFromAccountName(accountName) {
  const db = getDb();
  const Account = db.account;
  const AccountGroup = db.accountGroup;
  const account = await Account.findOne({ where: { name: accountName } });
  if (account) {
    const accountGroup = await AccountGroup.findOne({ where: { account_id: account.id } });
    return accountGroup ? accountGroup.group_id : null;
  }
  return null;
}

// Helper function to get group ID by group name
async function getGroupId(groupName) {
  const db = getDb();
  const Group = db.group;
  const group = await Group.findOne({ where: { name: groupName } });
  return group ? group.id : null;
}

exports.updateEntry = async (req, res) => {
  const { id } = req.params;
  const { entry, dynamicFields } = req.body;
  console.log("entering");
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

    // Determine the amount based on exclude_from_total and field_category
    let amount = entry.total_amount;
    if (dynamicFields.some(field => field.field_category === 1 && field.exclude_from_total)) {
      amount = entry.value;
    }
    console.log("reached here");

    // Step 2: Update the journal entry
    const journalEntry = await JournalEntry.findOne({ where: { id: entry.journal_id }, transaction: t });
    console.log("reached here1");
    if (journalEntry) {
      await journalEntry.update({
        journal_date: entry.entry_date,
        description: entry.type === 1 ? 'Purchase Update' : 'Sale Update', // Description based on type
        user_id: entry.user_id,
        financial_year: entry.financial_year
      }, { transaction: t });

      // Step 3: Delete existing journal items
      await JournalItem.destroy({ where: { journal_id: journalEntry.id }, transaction: t });

      // Step 4: Insert new journal items
      const journalItems = [];

      if (entry.type === 1) { // Purchase Entry
        // First entry: Supplier Account (Credit)
        journalItems.push({
          journal_id: journalEntry.id,
          account_id: entry.account_id,
          group_id: await getGroupId('Sundary Creditors'),
          amount: amount,
          type: true // Credit
        });

        // Second entry: Purchase Account (Debit)
        journalItems.push({
          journal_id: journalEntry.id,
          account_id: await getAccountId('Purchase Account'),
          group_id: await getGroupIdFromAccountName('Purchase Account'),
          amount: entry.value,
          type: false // Debit
        });
      } else { // Sale Entry
        // First entry: Customer Account (Debit)
        journalItems.push({
          journal_id: journalEntry.id,
          account_id: entry.account_id,
          group_id: await getGroupId('Sundary Debtors'),
          amount: amount,
          type: false // Debit
        });

        // Second entry: Sales Account (Credit)
        journalItems.push({
          journal_id: journalEntry.id,
          account_id: await getAccountId('Sales Account'),
          group_id: await getGroupIdFromAccountName('Sales Account'),
          amount: entry.value,
          type: true // Credit
        });
      }

      // Other entries based on dynamic fields
      for (const field of dynamicFields) {
        if (field.field_category === 1) {
          let accountName = field.field_name.replace(/[0-9%]/g, '').trim();
          accountName = accountName.replace(/\s+/g, ' '); // Remove extra spaces
          accountName = accountName.replace(/^\.+|\.+$/g, ''); // Remove leading and trailing periods
          accountName = accountName.replace(/RCM\s+/g, 'RCM '); // Handle "RCM 2.5% SGST" -> "RCM SGST"
          accountName = accountName.replace(/\s+\./g, ''); // Remove spaces before periods
          accountName = accountName.replace(/\.\s+/g, ''); // Remove periods before spaces
          accountName = accountName.replace(/^\s+|\s+$/g, ''); // Remove leading and trailing spaces
          console.log(accountName);
          const groupId = await getGroupIdFromAccountName(accountName);
          const type = entry.type === 1 ? (field.exclude_from_total ? true : false) : (field.exclude_from_total ? false : true); // Adjust type based on entry type
          journalItems.push({
            journal_id: journalEntry.id,
            account_id: await getAccountId(accountName),
            group_id: groupId,
            amount: field.field_value,
            type: type
          });
        }
      }

      await JournalItem.bulkCreate(journalItems, {
        fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
        returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
        transaction: t
      });
    }

    await t.commit();
    res.status(200).json({ message: 'Entry updated successfully' });
  } catch (error) {
    console.log(error);
    await t.rollback();
    res.status(500).json({ error: error.message });
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
      if (![1, 2,3,4].includes(entryType)) {
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
    res.status(200).json({ message: 'Entry deleted successfully' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

