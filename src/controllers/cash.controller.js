const {getDb} = require("../utils/getDb");
const { broadcast } = require('../websocket'); // Import the broadcast function


exports.cashBookListForDayBook = async (req, res) => {
  try {
    const db = getDb();
    const CashEntry = db.cash;
    const userid = req.query.userId;
    const financial_year = req.query.financialYear;
    const limit = parseInt(req.query.limit) || 50;
    const cursorDate = req.query.cursorDate || null;
    const cursorId = req.query.cursorId || null;

    const whereClause = {
      user_id: userid,
      financial_year: financial_year
    };

    if (cursorDate && cursorId) {
      whereClause[db.Sequelize.Op.or] = [
        { cash_date: { [db.Sequelize.Op.gt]: cursorDate } },
        { cash_date: cursorDate, id: { [db.Sequelize.Op.gt]: cursorId } }
      ];
    }

    const cashEntries = await CashEntry.findAll({
      where: whereClause,
      order: [['cash_date', 'ASC'], ['id', 'ASC']],
      limit: limit
    });

    const transformedEntries = cashEntries.map(entry => ({
      id: entry.id,
      cash_entry_date: new Date(entry.cash_date),
      account_id: entry.account_id,
      narration_description: entry.narration,
      amount: entry.amount,
      type: entry.type
    }));

    const nextCursorDate = cashEntries.length > 0 ? cashEntries[cashEntries.length - 1].cash_date : null;
    const nextCursorId = cashEntries.length > 0 ? cashEntries[cashEntries.length - 1].id : null;

    return res.json({ entries: transformedEntries, nextCursorDate, nextCursorId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


exports.getCashEntryById = async (req, res) => {
  try {
    const entryId = req.params.id;
    const db = getDb();
    const CashEntry = db.cash;
    const Account = db.account;

    if (!entryId) {
      return res.status(400).json({ error: 'Entry ID is required' });
    }

    const cashEntry = await CashEntry.findOne({
      where: { id: entryId },
      include: [
        {
          model: Account,
          attributes: ['name'] // Fetch the account name from the Account model
        }
      ]
    });

    if (cashEntry) {
      // Transform the data to match the CashEntry interface
      const transformedEntry = {
        id: cashEntry.id,
        cash_entry_date: new Date(cashEntry.cash_date),
        account_id: cashEntry.account_id,
        account_name: cashEntry.Account.name, // Get account_name from the joined Account table
        narration_description: cashEntry.narration,
        amount: cashEntry.amount,
        type: cashEntry.type,
        cash_debit: !cashEntry.type ? cashEntry.amount : 0,
        cash_credit: cashEntry.type ? cashEntry.amount : 0,
        balance: 0, // Initial balance, will be recalculated on the client side
        user_id: cashEntry.user_id,
        financial_year: cashEntry.financial_year
      };

      return res.status(200).json(transformedEntry);
    } else {
      return res.status(404).json({ message: 'Cash entry not found' });
    }
  } catch (error) {
    console.error('Error fetching cash entry:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


exports.cashBookList = async (req, res) => {
  try {
    const db = getDb();
    const userid = req.query.userId;
    const financial_year = req.query.financialYear;

    // Fetch data from the `combined_cash_entries` view and join with `account_list` to get account_name
    const cashEntries = await db.sequelize.query(
      `
      SELECT 
        cce.id,
        cce.cash_date,
        cce.account_id,
        cce.group_id,
        cce.narration,
        cce.amount,
        cce.type,
        cce.user_id,
        cce.financial_year,
        al.name AS account_name -- Join to get account_name from account_list
      FROM combined_cash_entries AS cce
      LEFT JOIN account_list AS al
      ON cce.account_id = al.id
      WHERE cce.user_id = :userId AND cce.financial_year = :financialYear
      ORDER BY cce.cash_date ASC
      `,
      {
        replacements: { userId: userid, financialYear: financial_year },
        type: db.sequelize.QueryTypes.SELECT, // Query the view and join with account_list
      }
    );

    // Transform the data to match the CashEntry interface
    const transformedEntries = cashEntries.map(entry => ({
      id: entry.id,
      cash_entry_date: new Date(entry.cash_date),
      account_id: entry.account_id,
      group_id: entry.group_id,
      account_name: entry.account_name, // Fetched from account_list
      narration_description: entry.narration,
      amount: entry.amount,
      type: entry.type,
      cash_debit: !entry.type ? entry.amount : 0,
      cash_credit: entry.type ? entry.amount : 0,
      balance: 0, // Initial balance, will be recalculated on the client side
      user_id: entry.user_id,
      financial_year: entry.financial_year,
    }));

    return res.json(transformedEntries);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


exports.cashEntryUpdate = async (req, res) => {
  const { id } = req.params;
  const { cash_entry_date, narration_description, account_id, type, amount, user_id, financial_year,group_id } = req.body;
  try {
    const db = getDb();
    const CashEntry = db.cash;
    const cashEntry = await CashEntry.findByPk(id);
    if (!cashEntry) {
      return res.status(404).json({ error: 'Cash entry not found' });
    }
    cashEntry.cash_date = cash_entry_date;
    cashEntry.narration = narration_description;
    cashEntry.account_id = account_id;
    cashEntry.type = type;
    cashEntry.amount = amount;
    cashEntry.user_id = user_id;
    cashEntry.financial_year = financial_year;
    cashEntry.group_id = group_id;
    await cashEntry.save();
    broadcast({ type: 'UPDATE', data: cashEntry, entryType: 'cash', user_id, financial_year }); // Emit WebSocket message
    return res.status(200).json({ message: 'Cash entry updated successfully' }); // Simplified response
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Add a new cash entry
exports.cashEntryCreate = async (req, res) => {
  const { cash_entry_date, narration_description, account_id, type, amount, user_id, financial_year,group_id } = req.body;
  const cash_date = cash_entry_date;
  const narration = narration_description;
  try {
    const db = getDb();
    const CashEntry = db.cash;
    const cashEntry = await CashEntry.create({
      cash_date,
      narration,
      account_id,
      type,
      amount,
      user_id,
      financial_year,
      group_id
    });
    broadcast({ type: 'INSERT', data: cashEntry, entryType: 'cash', user_id, financial_year }); // Emit WebSocket message
    return res.status(201).json({ message: 'Cash entry created successfully' }); // Simplified response
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete Account
exports.cashEntryDelete = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const CashEntry = db.cash;
    const cashEntry = await CashEntry.findByPk(id);
    if (!cashEntry) {
      return res.status(404).json({ error: 'Cash entry not found' });
    }
    await CashEntry.destroy({
      where: { id: id } // Add id to the where clause
    });
    broadcast({ type: 'DELETE', data: cashEntry, entryType: 'cash', user_id: cashEntry.user_id, financial_year: cashEntry.financial_year }); // Emit WebSocket message
    return res.status(204).send(); // Simplified response
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};