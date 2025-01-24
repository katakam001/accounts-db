const { getDb } = require("../utils/getDb");

exports.getInitialBalance = async (req, res) => {
  const { userId, financialYear } = req.query;
  try {
    const db = getDb();
    const Balance = db.balance;

    const current_balance = await Balance.findOne({
      where: { user_id: userId, financial_year: financialYear }
    });

    if (!current_balance) {
      return res.status(404).json({ error: 'Balance not found' });
    }

    res.json(current_balance);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
