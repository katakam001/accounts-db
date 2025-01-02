const {getDb} = require("../utils/getDb");

exports.cashBookList = async (req, res) => {
  try {
    const db = getDb();
    const CashEntry = db.cash;
    const Account = db.account;
    const userid = req.query.userId;
    const financial_year = req.query.financialYear;

    const cashEntries = await CashEntry.findAll({
      where: {
        user_id: userid,
        financial_year: financial_year
      },
      include: [
        {
          model: Account,
          attributes: ['name'] // Fetch the account name from the Account model
        }
      ]
    });

    // Transform the data to match the CashEntry interface
    const transformedEntries = cashEntries.map(entry => ({
      id: entry.id,
      cash_entry_date: new Date(entry.cash_date),
      account_id: entry.account_id,
      account_name: entry.Account.name, // Get account_name from the joined Account table
      narration_description: entry.narration,
      amount: entry.amount,
      type: entry.type,
      cash_debit: !entry.type ? entry.amount : 0,
      cash_credit: entry.type ? entry.amount : 0,
      balance: 0, // Initial balance, will be recalculated on the client side
      user_id: entry.user_id,
      financial_year: entry.financial_year
    }));

    res.json(transformedEntries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.cashEntryUpdate = async (req, res) => {
  const { id } = req.params;
  const { cash_entry_date, narration_description, account_id, type, amount, user_id, financial_year } = req.body;
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
    await cashEntry.save();
    res.json(cashEntry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add a new cash entry
exports.cashEntryCreate = async (req, res) => {
  const { cash_entry_date, narration_description, account_id, type, amount, user_id, financial_year } = req.body;
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
    });
    res.status(201).json(cashEntry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
    res.json(cashEntry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



