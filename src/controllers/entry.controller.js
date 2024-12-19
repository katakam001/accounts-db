const db = require("../models");
const PurchaseEntry = db.purchaseEntry;
const PurchaseEntryField = db.purchaseEntryField;
const PurchaseCategories=db.purchaseCategories;
const Account = db.account;
const Units = db.units;
const JournalItem = db.journalItem;
const JournalEntry = db.journalEntry;
const AccountGroup = db.accountGroup;
const Group = db.group;

exports.getEntries = async (req, res) => {
  const user_id = req.query.userId;
  const financial_year = req.query.financialYear;
  if (!user_id) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }
  if (!financial_year) {
    return res.status(400).json({ error: 'financialYear query parameter is required' });
  }
  try {
    const entries = await PurchaseEntry.findAll({
      where: {
        user_id,
        financial_year
      },
      attributes: [
        'id',
        'category_id',
        'purchase_date',
        'account_id',
        'item_description',
        'quantity',
        'unit_price',
        'total_amount',
        'user_id',
        'financial_year',
        'purchase_value',
        'journal_id',
        [db.sequelize.col('category.name'), 'category_name'],
        [db.sequelize.col('account.name'), 'account_name'],
        [db.sequelize.col('unit.name'), 'unit_name'],
        [db.sequelize.col('unit.id'), 'unit_id']
      ],
      include: [
        {
          model: PurchaseEntryField,
          as: 'fields',
          attributes: [
            'id',
            'entry_id',
            'field_name',
            'field_value'
          ]
        },
        {
          model: PurchaseCategories,
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
  console.log(entry);
  console.log(dynamicFields);

  const t = await db.sequelize.transaction();

  try {
    // Step 1: Insert a new journal entry
    const journalEntry = await JournalEntry.create({
      journal_date: entry.purchase_date,
      description: 'Purchase Entry',
      user_id: entry.user_id,
      financial_year: entry.financial_year
    }, { transaction: t });

    // Step 2: Insert a new purchase entry with the journal_id
    entry.journal_id = journalEntry.id;
    const newEntry = await PurchaseEntry.create(entry, { transaction: t });
    const entryFields = dynamicFields.map(field => ({
      entry_id: newEntry.id,
      field_name: field.field_name,
      field_value: field.field_value
    }));
    console.log(entryFields);
    await PurchaseEntryField.bulkCreate(entryFields, { transaction: t });

    // Determine the amount based on exclude_from_total and field_category
    let amount = entry.total_amount;
    if (dynamicFields.some(field => field.field_category === 1 && field.exclude_from_total)) {
      amount = entry.purchase_value;
    }

    // Step 3: Insert journal items for the purchase entry
    const journalItems = [];

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
      account_id: await getAccountId('PURCHASE ACCOUNT'),
      group_id: await getGroupIdFromAccountName('PURCHASE ACCOUNT'),
      amount: entry.purchase_value,
      type: false // Debit
    });

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
        const type = field.exclude_from_total ? true : false; // Credit if exclude_from_total, otherwise Debit
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
  const account = await Account.findOne({ where: { name: accountName } });
  return account ? account.id : null;
}

async function getGroupIdFromAccountName(accountName) {
  const account = await Account.findOne({ where: { name: accountName } });
  if (account) {
    const accountGroup = await AccountGroup.findOne({ where: { account_id: account.id } });
    return accountGroup ? accountGroup.group_id : null;
  }
  return null;
}

// Helper function to get group ID by group name
async function getGroupId(groupName) {
  const group = await Group.findOne({ where: { name: groupName } });
  return group ? group.id : null;
}



exports.updateEntry = async (req, res) => {
  const { id } = req.params;
  console.log(id);
  const { entry, dynamicFields } = req.body;
  const t = await db.sequelize.transaction();
  console.log("entering");

  try {
    // Step 1: Update the purchase entry
    await PurchaseEntry.update(entry, { where: { id }, transaction: t });
    await PurchaseEntryField.destroy({ where: { entry_id: id }, transaction: t });
    const entryFields = dynamicFields.map(field => ({
      entry_id: id,
      field_name: field.field_name,
      field_value: field.field_value
    }));
    await PurchaseEntryField.bulkCreate(entryFields, { transaction: t });

    // await PurchaseEntryField.bulkCreate(entryFields, 
    // {
    //   fields: ['entry_id','field_name','field_value','createdAt','updatedAt'],
    //   returning: ['entry_id','field_name','field_value','createdAt','updatedAt'],
    //   transaction: t
    // });

    // Determine the amount based on exclude_from_total and field_category
    let amount = entry.total_amount;
    if (dynamicFields.some(field => field.field_category === 1 && field.exclude_from_total)) {
      amount = entry.purchase_value;
    }
    console.log("reached here");

    // Step 2: Update the journal entry
    const journalEntry = await JournalEntry.findOne({ where: { id: entry.journal_id }, transaction: t });
    console.log("reached here1");
    if (journalEntry) {
      await journalEntry.update({
        journal_date: entry.purchase_date,
        description: 'Purchase Update',
        user_id: entry.user_id,
        financial_year: entry.financial_year
      }, { transaction: t });

      // Step 3: Delete existing journal items
      await JournalItem.destroy({ where: { journal_id: journalEntry.id }, transaction: t });

      // Step 4: Insert new journal items
      const journalItems = [];

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
        account_id: await getAccountId('PURCHASE ACCOUNT'),
        group_id: await getGroupIdFromAccountName('PURCHASE ACCOUNT'),
        amount: entry.purchase_value,
        type: false // Debit
      });

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
          const type = field.exclude_from_total ? true : false; // Credit if exclude_from_total, otherwise Debit
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
  const t = await db.sequelize.transaction();

  try {
    // Find the purchase entry to get the journal_id
    const purchaseEntry = await PurchaseEntry.findOne({ where: { id }, transaction: t });
    if (purchaseEntry) {
      const journalId = purchaseEntry.journal_id;

      // Delete the purchase entry fields
      await PurchaseEntryField.destroy({ where: { entry_id: id }, transaction: t });

      // Delete the purchase entry
      await PurchaseEntry.destroy({ where: { id }, transaction: t });

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
