const { getDb } = require("../utils/getDb");
const { broadcast } = require('../websocket'); // Import the broadcast function


exports.getEntries = async (req, res) => {
  const user_id = req.query.userId;
  const financial_year = req.query.financialYear;
  const type = req.query.type;
  const startRow = parseInt(req.query.nextStartRow, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 10;

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
    const bufferSize = 10;
    const endRow = startRow + pageSize + bufferSize;

   
    const [entriesBuffer] = await db.sequelize.query(
      `WITH CTE AS (
          SELECT e.*, 
                 json_agg(json_build_object('field_id', ef.field_id, 'field_value', ef.field_value)) AS fields, 
                 ROW_NUMBER() OVER (ORDER BY e.entry_date , e.id) as row_num
          FROM entries e
          LEFT JOIN entry_fields ef ON e.id = ef.entry_id
          WHERE e.user_id = :user_id AND e.financial_year = :financial_year AND e.type = :type
          GROUP BY e.id
      )
      SELECT * FROM CTE
            WHERE row_num BETWEEN :startRow AND :endRow`,
      {
        replacements: { user_id, financial_year, type, startRow, endRow }
      }
    );

    // console.log(entriesBuffer);
    

    // Step 2: Identify the last invoice number in the batch
    const lastInvoiceNumber = entriesBuffer[pageSize - 1]?.invoiceNumber;
    let lastIndex = pageSize - 1;

    // Step 3: Ensure all entries with the same invoice number are included
    for (let i = pageSize; i < entriesBuffer.length; i++) {
      if (entriesBuffer[i].invoiceNumber === lastInvoiceNumber) {
        lastIndex = i;
      } else {
        break;
      }
    }

    // Step 3: Ensure all entries with the same invoice number are included
    const validEntries = entriesBuffer.slice(0, lastIndex + 1);
    // console.log(validEntries)

    // Step 4: Determine if there are more records
    const hasMoreRecords = entriesBuffer.length > validEntries.length;
    const nextStartRow = startRow + validEntries.length;

    const groupedEntries = validEntries.map(entry => ({
      id: entry.id,
      category_id: entry.category_id,
      entry_date: entry.entry_date,
      account_id: entry.account_id,
      item_id: entry.item_id,
      quantity: entry.quantity,
      unit_price: entry.unit_price,
      total_amount: entry.total_amount,
      user_id: entry.user_id,
      financial_year: entry.financial_year,
      value: entry.value,
      journal_id: entry.journal_id,
      type: entry.type,
      unit_id: entry.unit_id,
      invoiceNumber: entry.invoiceNumber,
      category_account_id: entry.category_account_id,
      fields: entry.fields ? JSON.parse(JSON.stringify(entry.fields)) : []
    }));


    res.json({
      entries: groupedEntries,
      nextStartRow: nextStartRow,
      hasMore: hasMoreRecords
    });
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

exports.addEntries = async (req, res) => {
  const { entries } = req.body;

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

    // Step 1: Insert a new journal entry
    const journalEntry = await JournalEntry.create({
      journal_date: journalDate,
      user_id: userId,
      financial_year: financialYear,
      type: type
    }, { transaction: t });

    const allJournalItems = [];
    let total_amount = 0;

    const updatedEntries = []; // Array to store entries with assigned IDs

    for (const entry of entries) {
      // Remove dynamicFields from entry before creating new Entry
      const { dynamicFields, id,customerName, ...entryWithoutDynamicFields } = entry;

      // Step 2: Insert a new entry with the journal_id
      entryWithoutDynamicFields.journal_id = journalEntry.id;
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

    // Broadcast the new entry along with journal entries and items (excluding entryFields)
    const broadcastData = {
      entries: updatedEntries,
      group: { type: type },
      journalEntry: {
        id: journalEntry.id,
        journal_date: journalEntry.journal_date,
        description: journalEntry.description,
        type: journalEntry.type,
        items: allJournalItems
      }
    };

    broadcast({ type: 'INSERT', data: broadcastData, entryType: 'entry', user_id: userId, financial_year: financialYear });

    res.status(201).json({ message: 'Entries created successfully' });
  } catch (error) {
    console.log(error);
    await t.rollback();
    res.status(500).json({ error: 'Internal server error' });
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
        amount: field.field_value,
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
    amount: amount,
    type: type,
    narration: narration // Add narration dynamically
  };
};

exports.updateEntries = async (req, res) => {
  const { entries } = req.body;

  try {
    const db = getDb();
    const t = await db.sequelize.transaction();
    const Entry = db.entry;
    const EntryField = db.entryField;
    const JournalItem = db.journalItem;
    const JournalEntry = db.journalEntry;

    const originalInvoiceNumber = entries[0].originalInvoiceNumber || entries[0].invoiceNumber;
    // console.log(originalInvoiceNumber);
    const newInvoiceNumber = entries[0].invoiceNumber;
    const journalId = entries[0].journal_id;
    const journalDate = entries[0].entry_date;
    const userId = entries[0].user_id;
    const financialYear = entries[0].financial_year;
    const type = entries[0].type;

    // Step 1: Update or create a new journal entry
    let journalEntry = await JournalEntry.findOne({
      where: { id: journalId },
      transaction: t
    });

    await journalEntry.update({
      journal_date: journalDate,
      // description: getDescription(type, true),
      user_id: userId,
      financial_year: financialYear,
      type: type
    }, { transaction: t });

    const existingEntries = await Entry.findAll({ where: { invoiceNumber: originalInvoiceNumber }, transaction: t });
    const existingEntryIds = existingEntries.map(entry => entry.id);

    // Identify and delete entries and their associated fields that are no longer present
    for (const entry of existingEntries) {
      if (!entries.some(e => e.id === entry.id && e.id !== undefined && e.id !== '')) {
        await EntryField.destroy({ where: { entry_id: entry.id }, transaction: t });
        await Entry.destroy({ where: { id: entry.id }, transaction: t });
      }
    }

    const allJournalItems = [];
    let total_amount = 0;

    const updatedEntries = []; // Array to store updated entries

    for (const entry of entries) {
      const { id, dynamicFields,customerName, ...entryWithoutDynamicFields } = entry;

      // Step 2: Update or create new entries with the journal_id
      let updatedEntry;
      if (id && existingEntryIds.includes(id)) {
        await Entry.update(entryWithoutDynamicFields, { where: { id }, transaction: t });
        updatedEntry = await Entry.findOne({ where: { id }, transaction: t });
        await EntryField.destroy({ where: { entry_id: id }, transaction: t });
      } else {
        entryWithoutDynamicFields.journal_id = journalEntry.id;
        entryWithoutDynamicFields.invoiceNumber = newInvoiceNumber; // Update to new invoice number
        updatedEntry = await Entry.create(entryWithoutDynamicFields, { transaction: t });
      }

      const entryFields = dynamicFields.map(field => ({
        entry_id: updatedEntry.id,
        field_id: field.field_id,
        field_value: field.field_value
      }));
      await EntryField.bulkCreate(entryFields, { transaction: t });

      // Determine the amount based on exclude_from_total and field_category
      const amount = dynamicFields.some(field => field.field_category === 1 && field.exclude_from_total) ? entry.value : entry.total_amount;
      total_amount += parseFloat(amount); // Parse the amount before summation


      // Add updated entry to the updatedEntries array
      updatedEntries.push({
        ...updatedEntry.toJSON(),
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

    // Step 4: Delete existing journal items and insert new ones
    await JournalItem.destroy({ where: { journal_id: journalEntry.id }, transaction: t });
    await JournalItem.bulkCreate(allJournalItems, {
      fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt','narration'],
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt','narration'],
      transaction: t
    });

    await t.commit();

    // Broadcast the updated entries along with journal entries and items (excluding entryFields)
    const broadcastData = {
      entries: updatedEntries,
      group: { type: type },
      journalEntry: {
        id: journalEntry.id,
        journal_date: journalEntry.journal_date,
        description: journalEntry.description,
        type: journalEntry.type,
        items: allJournalItems
      },
      originalInvoiceNumber:originalInvoiceNumber, // Include the original invoice number
      newInvoiceNumber:newInvoiceNumber // Include the new invoice number
    };


    broadcast({ type: 'UPDATE', data: broadcastData, entryType: 'entry', user_id: userId, financial_year: financialYear });

    res.status(200).json({ message: 'Entries updated successfully' });
  } catch (error) {
    console.log(error);
    await t.rollback();
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteEntries = async (req, res) => {
  const { invoiceNumber } = req.params;

  try {
    const db = getDb();
    const t = await db.sequelize.transaction();
    const Entry = db.entry;
    const EntryField = db.entryField;
    const JournalItem = db.journalItem;
    const JournalEntry = db.journalEntry;

    // Find all entries linked to the provided invoiceNumber
    const entries = await Entry.findAll({ where: { invoiceNumber }, transaction: t });

    if (entries.length === 0) {
      await t.rollback();
      return res.status(404).json({ error: 'No entries found for the provided invoice number' });
    }

    const journalId = entries[0].journal_id;
    const type = entries[0].type;


    // Find the journal entry associated with the invoice number
    const journalEntryExist = await JournalEntry.findOne({ where: { id: journalId }, transaction: t });
    if (!journalEntryExist) {
      await t.rollback();
      return res.status(404).json({ error: `Journal entry not found for journal ID: ${journalId}` });
    }

    for (const entry of entries) {
      const entryId = entry.id;

      // Delete the entry fields
      await EntryField.destroy({ where: { entry_id: entryId }, transaction: t });

      // Delete the entry
      await Entry.destroy({ where: { id: entryId }, transaction: t });

    }

    // Delete the journal items
    await JournalItem.destroy({ where: { journal_id: journalId }, transaction: t });

    // Delete the journal entry
    await JournalEntry.destroy({ where: { id: journalId }, transaction: t });

    await t.commit();

    // Broadcast the deletion event for the invoice number
    const broadcastData = {
      group: { invoiceNumber: invoiceNumber, type: type, journal_id: journalId, journal_date: journalEntryExist.journal_date }
    };

    broadcast({ type: 'DELETE', data: broadcastData, entryType: 'entry', user_id: journalEntryExist.user_id, financial_year: journalEntryExist.financial_year });

    res.status(204).send(); // No content
  } catch (error) {
    console.log(error);
    await t.rollback();
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.generateJournalEntriesAndUpdateEntries = async () => {
  try {
    const db = getDb();
    const Entry = db.entry;
    const EntryField = db.entryField;
    const FieldsMapping = db.fieldsMapping;
    // Fetch all entries
    // const entries = await Entry.findAll();
    const invoiceNumber = "622";

    const entries = await Entry.findAll({
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
        'unit_id',
        'invoiceNumber',
        'category_account_id',
            ] // Specify the columns you need
    });

    const cleanEntries = entries.map(entry => entry.dataValues);

    // Group entries by invoiceNumber
    const groupedEntries = cleanEntries.reduce((acc, entry) => {
      if (!acc[entry.invoiceNumber]) {
        acc[entry.invoiceNumber] = [];
      }
      acc[entry.invoiceNumber].push(entry);
      return acc;
    }, {});

    // console.log(groupedEntries);

    // Process each group of entries
    for (const invoiceNumber in groupedEntries) {
      if (groupedEntries.hasOwnProperty(invoiceNumber)) {
        const group = groupedEntries[invoiceNumber];

                // Fetch entry fields and their corresponding field mappings for the current group
                for (const entry of group) {
                  // Fetch entry fields for the current entry
                  const entryFields = await EntryField.findAll({
                    where: { entry_id: entry.id },
                    attributes: ['entry_id', 'field_id', 'field_value']
                  });
        
                  // Fetch field mappings for the entry fields
                  const fieldIds = entryFields.map(field => field.field_id);
                  const fieldMappings = await FieldsMapping.findAll({
                    where: { field_id: fieldIds, category_id: entry.category_id },
                    attributes: ['field_id', 'field_type', 'field_category', 'exclude_from_total','account_id']
                  });
        
                  // Combine entry fields and field mappings based on field_id
                  entry.dynamicFields = entryFields.map(field => {
                    const fieldMapping = fieldMappings.find(mapping => mapping.field_id === field.field_id);
                    return {
                      field_id: field.field_id,
                      field_value: field.field_value,
                      field_type: fieldMapping.field_type,
                      field_category: fieldMapping.field_category,
                      exclude_from_total: fieldMapping.exclude_from_total,
                      tax_account_id:fieldMapping.account_id
                    };
                  });
                }

        // Remove existing journal_entries and journal_items for each entry in the group
        await removeExistingJournalEntriesAndItems(group);

        // Create new journal_entry and update entries with new journal_id
        await processGroupForJournalEntries(group);
      }
    }

    console.log('Journal entries and items generated and entries updated successfully');
  } catch (error) {
    console.log('Error generating journal entries and items:', error);
  }
};

const removeExistingJournalEntriesAndItems = async (entries) => {
  const db = getDb();
  const JournalEntry = db.journalEntry;
  const JournalItem = db.journalItem;

  for (const entry of entries) {
    // Find and remove the existing journal_entry and journal_items for the entry
    const existingJournalEntry = await JournalEntry.findOne({ where: { id: entry.journal_id } });
    if (existingJournalEntry) {
      await JournalItem.destroy({ where: { journal_id: existingJournalEntry.id } });
      await JournalEntry.destroy({ where: { id: existingJournalEntry.id } });
    }
  }
};

const processGroupForJournalEntries = async (entries) => {
  // console.log(entries);
  const db = getDb();
  const t = await db.sequelize.transaction();
  const Entry = db.entry;
  const JournalItem = db.journalItem;
  const JournalEntry = db.journalEntry;
  const Account = db.account;
  const invoiceNumber = entries[0].invoiceNumber;
  const journalDate = entries[0].entry_date;
  const userId = entries[0].user_id;
  const financialYear = entries[0].financial_year;
  const type = entries[0].type;



  try {
    // Step 1: Update or create a new journal entry
    const account = await Account.findOne({
      where: { id: entries[0].account_id },
      transaction: t
    });
    const customerName =account.name;
    // Step 1: Insert a new journal entry
    const journalEntry = await JournalEntry.create({
      journal_date: journalDate,
      user_id: userId,
      financial_year: financialYear,
      type: type
    }, { transaction: t });

    // Step 2: Update all entries in the group with the new journal_id
    for (const entry of entries) {
      await Entry.update({ journal_id: journalEntry.id }, { where: { id: entry.id }, transaction: t });
    }

    const allJournalItems = [];
    let total_amount = 0;

    for (const entry of entries) {
      // Fetch entry fields for the current entry
      const dynamicFields = entry.dynamicFields;
    //  console.log(dynamicFields);


      // Determine the amount based on exclude_from_total and field_category
      const amount = dynamicFields.some(field => field.field_category === 1 && field.exclude_from_total) ? entry.value : entry.total_amount;
      // console.log(amount);
      total_amount += parseFloat(amount); // Parse the amount before summation
            // console.log(total_amount);
      // console.log(dynamicFields);

      // Step 3: Insert journal items for the entry
      const journalItems = await getJournalItems(entry, dynamicFields, journalEntry.id, amount,customerName);
      allJournalItems.push(...journalItems);
    }
    // console.log(total_amount);
    // Create party journal item once per invoice
    const partyJournalItems = await getPartyJournalItems(entries[0], total_amount, journalEntry.id);
    // Add partyJournalItems to the front of the allJournalItems array
    allJournalItems.unshift(...partyJournalItems);

    await JournalItem.bulkCreate(allJournalItems, {
      fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt','narration'],
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt','narration'],
      transaction: t
    });

    await t.commit();

  } catch (error) {
    console.log('Error processing group of entries:', error);
    await t.rollback();
    throw error;
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
