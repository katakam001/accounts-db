const db = require("../models");
const JournalEntry = db.journalEntry;
const JournalItem = db.journalItem;

exports.getJournalEntries = async (req, res) => {
  try {
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


exports.deleteJournalEntry = async (req, res) => {
  const entryId = req.params.id;

  try {
    // Delete journal entry and its associated items
    const deleted = await JournalEntry.destroy({
      where: { id: entryId },
      include: [
        {
          model: JournalItem,
          as: 'items',
        },
      ],
    });

    if (!deleted) {
      return res.status(404).send('Journal entry not found');
    }

    res.send({ message: 'Journal entry deleted successfully' });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.updateJournalEntry = async (req, res) => {
  const entryId = req.params.id;
  const updatedEntry = req.body;

  // Convert journal_date string to Date object
  const journalDate = new Date(updatedEntry.journal_date);

  try {
    // Update journal entry
    const [affectedRows, updated] = await JournalEntry.update(
      {
        journal_date: journalDate,
        description: updatedEntry.description,
        user_id: updatedEntry.user_id,
        updatedAt: new Date(),
        financial_year: updatedEntry.financial_year,
      },
      {
        where: { id: entryId },
        returning: true,
        plain: true,
      }
    );

    if (affectedRows === 0) {
      return res.status(404).send('Journal entry not found');
    }
    console.log("line is coming");


    // Delete existing journal items
    await JournalItem.destroy({
      where: { journal_id: entryId },
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

    console.log("line is coming1");

    await JournalItem.bulkCreate(journalItems, {
      fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'],
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt']
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
      type: db.sequelize.QueryTypes.SELECT
    });

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

    res.status(200).json(formattedEntries);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.createJournalEntryWithItems = async (req, res) => {
  const newEntry = req.body;

  // Convert journal_date string to Date object
  const journalDate = new Date(newEntry.journal_date);

  try {
    // Create new journal entry
    const createdJournalEntry = await JournalEntry.create({
      journal_date: journalDate,
      description: newEntry.description,
      user_id: newEntry.user_id,
      createdAt: new Date(),
      updatedAt: new Date(),
      financial_year: newEntry.financial_year
    });

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
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt']
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
      type: db.sequelize.QueryTypes.SELECT
    });

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

    res.status(200).json(formattedEntries);
  } catch (error) {
    res.status(500).send(error.message);
  }
};