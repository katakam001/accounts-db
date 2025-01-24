const { getDb } = require("../utils/getDb");
const { broadcast } = require('../websocket'); // Import the broadcast function


exports.journalBookListForDayBook = async (req, res) => {
  try {
    const db = getDb();
    const userid = req.query.userId;
    const financial_year = req.query.financialYear;
    const limit = parseInt(req.query.limit) || 50;
    const cursorDate = req.query.cursorDate || null;
    const cursorId = req.query.cursorId || null;

    const query = `
      SELECT 
        je.id AS journal_id, 
        je.journal_date, 
        je.description, 
        je.type AS journal_type,  
        ji.account_id, 
        ji.amount, 
        ji.type AS item_type,  
        e.id AS entry_id  
      FROM 
        journal_entries je
      LEFT JOIN 
        journal_items ji ON je.id = ji.journal_id
      LEFT JOIN 
        entries e ON je.id = e.journal_id  
      WHERE 
        je.user_id = :userid AND 
        je.financial_year = :financial_year
        ${cursorDate && cursorId ? 'AND (je.journal_date > :cursorDate OR (je.journal_date = :cursorDate AND je.id > :cursorId))' : ''}
      ORDER BY 
        je.journal_date ASC, je.id ASC
      LIMIT :limit
    `;

    const replacements = { userid, financial_year, limit };
    if (cursorDate && cursorId) {
      replacements.cursorDate = cursorDate;
      replacements.cursorId = cursorId;
    }

    const journalEntries = await db.sequelize.query(query, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT
    });

    const transformedEntries = journalEntries.reduce((acc, entry) => {
      const existingEntry = acc.find(e => e.journal_id === entry.journal_id);
      if (existingEntry) {
        existingEntry.items.push({
          account_id: entry.account_id,
          amount: entry.amount,
          type: entry.item_type
        });
      } else {
        acc.push({
          journal_id: entry.journal_id,
          journal_date: new Date(entry.journal_date),
          description: entry.description,
          type: entry.journal_type,
          entry_id: entry.entry_id,
          items: [{
            account_id: entry.account_id,
            amount: entry.amount,
            type: entry.item_type
          }]
        });
      }
      return acc;
    }, []);

    const nextCursorDate = journalEntries.length > 0 ? journalEntries[journalEntries.length - 1].journal_date : null;
    const nextCursorId = journalEntries.length > 0 ? journalEntries[journalEntries.length - 1].journal_id : null;

    res.json({ entries: transformedEntries, nextCursorDate, nextCursorId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


exports.getJournalEntries = async (req, res) => {
  try {
    const db = getDb();
    const userId = req.query.userId;
    const financialYear = req.query.financialYear;
    const accountName = req.query.accountName || null;
    const groupName = req.query.groupName || null;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }
    if (!financialYear) {
      return res.status(400).json({ error: 'financialYear query parameter is required' });
    }

    let query = `
SELECT 
    "JournalEntry"."id" AS "journal_id", 
    "JournalEntry"."journal_date", 
    "JournalEntry"."description" AS "journal_description", 
    "JournalEntry"."financial_year", 
    "User"."username" AS "user_name", 
    "JournalItem"."account_id", 
    "Account"."name" AS "account_name", 
    "JournalItem"."group_id", 
    "Group"."name" AS "group_name", 
    "JournalItem"."amount", 
    "JournalItem"."type", 
    "JournalItem"."createdAt" AS "item_createdAt", 
    "JournalItem"."updatedAt" AS "item_updatedat"
FROM 
    "journal_entries" AS "JournalEntry"
LEFT JOIN 
    "journal_items" AS "JournalItem" ON "JournalEntry"."id" = "JournalItem"."journal_id"
LEFT JOIN 
    "account_list" AS "Account" ON "JournalItem"."account_id" = "Account"."id"
LEFT JOIN 
    "group_list" AS "Group" ON "JournalItem"."group_id" = "Group"."id"
LEFT JOIN 
    "users" AS "User" ON "JournalEntry"."user_id" = "User"."id"
WHERE 
    "JournalEntry"."user_id" = :userId
    AND "JournalEntry"."financial_year" = :financialYear
    `;

    if (accountName) {
      query += ` AND "Account"."name" = :accountName`;
    }

    if (groupName) {
      query += ` AND "Group"."name" = :groupName`;
    }

    const replacements = { userId, financialYear };
    if (accountName) replacements.accountName = accountName;
    if (groupName) replacements.groupName = groupName;

    const rawEntries = await db.sequelize.query(query, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT
    });

    // Format the results
    const formattedEntries = rawEntries.reduce((acc, entry) => {
      const existingEntry = acc.find(e => e.id === entry.journal_id);
      const item = {
        journal_id: entry.journal_id,
        account_id: entry.account_id,
        group_id: entry.group_id,
        amount: entry.amount,
        type: entry.type,
        account_name: entry.account_name,
        group_name: entry.group_name,
        debit_amount: entry.type ? 0 : entry.amount,
        credit_amount: entry.type ? entry.amount : 0,
      };

      if (existingEntry) {
        existingEntry.items.push(item);
      } else {
        acc.push({
          id: entry.journal_id,
          journal_date: entry.journal_date,
          description: entry.journal_description,
          user_id: userId,
          user_name: entry.user_name,
          financial_year: entry.financial_year,
          items: [item]
        });
      }

      return acc;
    }, []);

    res.status(200).json(formattedEntries);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getJournalEntryById = async (req, res) => {
  try {
    const db = getDb();
    const entryId = req.params.id;

    if (!entryId) {
      return res.status(400).json({ error: 'Entry ID is required' });
    }

    let query = `
SELECT 
    "JournalEntry"."id" AS "journal_id", 
    "JournalEntry"."journal_date", 
    "JournalEntry"."description" AS "journal_description", 
    "JournalEntry"."financial_year", 
    "User"."username" AS "user_name", 
    "JournalItem"."account_id", 
    "Account"."name" AS "account_name", 
    "JournalItem"."group_id", 
    "Group"."name" AS "group_name", 
    "JournalItem"."amount", 
    "JournalItem"."type", 
    "JournalItem"."createdAt" AS "item_createdAt", 
    "JournalItem"."updatedAt" AS "item_updatedat"
FROM 
    "journal_entries" AS "JournalEntry"
LEFT JOIN 
    "journal_items" AS "JournalItem" ON "JournalEntry"."id" = "JournalItem"."journal_id"
LEFT JOIN 
    "account_list" AS "Account" ON "JournalItem"."account_id" = "Account"."id"
LEFT JOIN 
    "group_list" AS "Group" ON "JournalItem"."group_id" = "Group"."id"
LEFT JOIN 
    "users" AS "User" ON "JournalEntry"."user_id" = "User"."id"
WHERE 
    "JournalEntry"."id" = :entryId
    `;

    const replacements = { entryId };

    const rawEntries = await db.sequelize.query(query, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT
    });

    // Format the results
    const formattedEntries = rawEntries.reduce((acc, entry) => {
      const existingEntry = acc.find(e => e.id === entry.journal_id);
      const item = {
        journal_id: entry.journal_id,
        account_id: entry.account_id,
        group_id: entry.group_id,
        amount: entry.amount,
        type: entry.type,
        account_name: entry.account_name,
        group_name: entry.group_name,
        debit_amount: entry.type ? 0 : entry.amount,
        credit_amount: entry.type ? entry.amount : 0,
      };

      if (existingEntry) {
        existingEntry.items.push(item);
      } else {
        acc.push({
          id: entry.journal_id,
          journal_date: entry.journal_date,
          description: entry.journal_description,
          user_id: entry.user_id,
          user_name: entry.user_name,
          financial_year: entry.financial_year,
          items: [item]
        });
      }

      return acc;
    }, []);

    if (formattedEntries.length > 0) {
      res.status(200).json(formattedEntries[0]);
    } else {
      res.status(404).json({ message: 'Journal entry not found' });
    }
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteJournalEntry = async (req, res) => {
  const entryId = req.params.id;

  try {
    const db = getDb();
    const transaction = await db.sequelize.transaction();
    const JournalEntry = db.journalEntry;
    const JournalItem = db.journalItem;
    // Delete journal entry and its associated items
    const deleted = await JournalEntry.destroy({
      where: { id: entryId },
      include: [
        {
          model: JournalItem,
          as: 'items',
        },
      ],
      transaction
    });

    if (!deleted) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    // Commit the transaction
    await transaction.commit();

    // Broadcast the deletion event
    broadcast({ type: 'DELETE', data: { id: entryId }, entryType: 'journal', user_id: req.body.user_id, financial_year: req.body.financial_year });

    res.status(204).send(); // Simplified response
  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    console.error('Error deleting journal entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateJournalEntry = async (req, res) => {
  const entryId = req.params.id;
  const updatedEntry = req.body;

  // Convert journal_date string to Date object
  const journalDate = new Date(updatedEntry.journal_date);

  try {
    const db = getDb();
    const transaction = await db.sequelize.transaction();
    const JournalEntry = db.journalEntry;
    const JournalItem = db.journalItem;
    // Update journal entry
    const [affectedRows, updated] = await JournalEntry.update(
      {
        journal_date: journalDate,
        description: updatedEntry.description,
        user_id: updatedEntry.user_id,
        updatedAt: new Date(),
        financial_year: updatedEntry.financial_year,
        type:0
      },
      {
        where: { id: entryId },
        returning: true,
        plain: true,
        transaction
      }
    );

    if (affectedRows === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    // Delete existing journal items
    await JournalItem.destroy({
      where: { journal_id: entryId },
      transaction
    });

    // Insert updated journal items
    const journalItems = updatedEntry.items.map(item => ({
      journal_id: entryId,
      account_id: item.account_id,
      group_id: item.group_id,
      amount: item.amount,
      type: item.type,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await JournalItem.bulkCreate(journalItems, {
      fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
      transaction
    });

    // Fetch the updated journal entry with items
    const updatedJournalEntry = await db.sequelize.query(`
      SELECT 
        "JournalEntry"."id" AS "journal_id", 
        "JournalEntry"."journal_date", 
        "JournalEntry"."description" AS "journal_description", 
        "JournalEntry"."financial_year", 
        "User"."username" AS "user_name", 
        "User"."id" AS "user_id", 
        "JournalItem"."account_id", 
        "Account"."name" AS "account_name", 
        "JournalItem"."group_id", 
        "Group"."name" AS "group_name", 
        "JournalItem"."amount", 
        "JournalItem"."type", 
        "JournalItem"."createdAt" AS "item_createdAt", 
        "JournalItem"."updatedAt" AS "item_updatedat"
      FROM 
        "journal_entries" AS "JournalEntry"
      LEFT JOIN 
        "journal_items" AS "JournalItem" ON "JournalEntry"."id" = "JournalItem"."journal_id"
      LEFT JOIN 
        "account_list" AS "Account" ON "JournalItem"."account_id" = "Account"."id"
      LEFT JOIN 
        "group_list" AS "Group" ON "JournalItem"."group_id" = "Group"."id"
      LEFT JOIN 
        "users" AS "User" ON "JournalEntry"."user_id" = "User"."id"
      WHERE 
        "JournalEntry"."id" = :entryId
    `, {
      replacements: { entryId },
      type: db.sequelize.QueryTypes.SELECT,
      transaction
    });

    // Commit the transaction
    await transaction.commit();

    // Format the results
    const formattedEntries = updatedJournalEntry.reduce((acc, entry) => {
      const existingEntry = acc.find(e => e.id === entry.journal_id);
      const item = {
        journal_id: entry.journal_id,
        account_id: entry.account_id,
        group_id: entry.group_id,
        amount: entry.amount,
        type: entry.type,
        account_name: entry.account_name,
        group_name: entry.group_name,
        debit_amount: entry.type ? 0 : entry.amount,
        credit_amount: entry.type ? entry.amount : 0,
      };

      if (existingEntry) {
        existingEntry.items.push(item);
      } else {
        acc.push({
          id: entry.journal_id,
          journal_date: entry.journal_date,
          description: entry.journal_description,
          user_id: entry.user_id,
          user_name: entry.user_name,
          financial_year: entry.financial_year,
          items: [item]
        });
      }

      return acc;
    }, []);

    broadcast({ type: 'UPDATE', data: formattedEntries[0], entryType: 'journal', user_id: updatedEntry.user_id, financial_year: updatedEntry.financial_year }); // Emit WebSocket message

    res.status(200).json({ message: 'Journal entry updated successfully' }); // Simplified response
  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    console.error('Error updating journal entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createJournalEntryWithItems = async (req, res) => {
  const newEntry = req.body;

  // Convert journal_date string to Date object
  const journalDate = new Date(newEntry.journal_date);

  try {
    const db = getDb();
    const transaction = await db.sequelize.transaction();
    const JournalEntry = db.journalEntry;
    const JournalItem = db.journalItem;

    // Create new journal entry
    const createdJournalEntry = await JournalEntry.create({
      journal_date: journalDate,
      description: newEntry.description,
      user_id: newEntry.user_id,
      createdAt: new Date(),
      updatedAt: new Date(),
      financial_year: newEntry.financial_year,
      type:0
    }, { transaction });

    // Insert journal items
    const journalItems = newEntry.items.map(item => ({
      journal_id: createdJournalEntry.id,
      account_id: item.account_id,
      group_id: item.group_id,
      amount: item.amount,
      type: item.type,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await JournalItem.bulkCreate(journalItems, {
      fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
      transaction
    });

    const entryId = createdJournalEntry.id;

    // Fetch the updated journal entry with items
    const updatedJournalEntry = await db.sequelize.query(`
      SELECT 
        "JournalEntry"."id" AS "journal_id", 
        "JournalEntry"."journal_date", 
        "JournalEntry"."description" AS "journal_description", 
        "User"."username" AS "user_name", 
        "User"."id" AS "user_id", 
        "JournalEntry"."financial_year", 
        "JournalItem"."account_id", 
        "Account"."name" AS "account_name", 
        "JournalItem"."group_id", 
        "Group"."name" AS "group_name", 
        "JournalItem"."amount", 
        "JournalItem"."type", 
        "JournalItem"."createdAt" AS "item_createdAt", 
        "JournalItem"."updatedAt" AS "item_updatedat"
      FROM 
        "journal_entries" AS "JournalEntry"
      LEFT JOIN 
        "journal_items" AS "JournalItem" ON "JournalEntry"."id" = "JournalItem"."journal_id"
      LEFT JOIN 
        "account_list" AS "Account" ON "JournalItem"."account_id" = "Account"."id"
      LEFT JOIN 
        "group_list" AS "Group" ON "JournalItem"."group_id" = "Group"."id"
      LEFT JOIN 
        "users" AS "User" ON "JournalEntry"."user_id" = "User"."id"
      WHERE 
        "JournalEntry"."id" = :entryId
    `, {
      replacements: { entryId },
      type: db.sequelize.QueryTypes.SELECT,
      transaction
    });

    // Commit the transaction
    await transaction.commit();

    // Format the results
    const formattedEntries = updatedJournalEntry.reduce((acc, entry) => {
      const existingEntry = acc.find(e => e.id === entry.journal_id);
      const item = {
        journal_id: entry.journal_id,
        account_id: entry.account_id,
        group_id: entry.group_id,
        amount: entry.amount,
        type: entry.type,
        account_name: entry.account_name,
        group_name: entry.group_name,
        debit_amount: entry.type ? 0 : entry.amount,
        credit_amount: entry.type ? entry.amount : 0,
      };

      if (existingEntry) {
        existingEntry.items.push(item);
      } else {
        acc.push({
          id: entry.journal_id,
          journal_date: entry.journal_date,
          description: entry.journal_description,
          user_id: entry.user_id,
          user_name: entry.user_name,
          financial_year: entry.financial_year,
          items: [item]
        });
      }

      return acc;
    }, []);

    broadcast({ type: 'INSERT', data: formattedEntries[0], entryType: 'journal', user_id: newEntry.user_id, financial_year: newEntry.financial_year }); // Emit WebSocket message
    res.status(201).json({ message: 'Journal entry created successfully' }); // Simplified response
  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    console.error('Error creating journal entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};