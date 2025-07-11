const { getDb } = require("../utils/getDb");

exports.getInitialBalance = async (req, res) => {
  const { userId, financialYear } = req.query;
  try {
    const db = getDb();

    const [netChangeResult] = await db.sequelize.query(
      `SELECT SUM(CASE WHEN type THEN amount ELSE -amount END) AS net_change
       FROM combined_cash_entries
       WHERE user_id = :user_id AND financial_year = :financial_year AND is_cash_adjustment IS NOT TRUE`,
      {
        replacements: { user_id: userId, financial_year: financialYear },
        type: db.sequelize.QueryTypes.SELECT,
      }
    );

    const netChange = netChangeResult.net_change || 0;

    res.json({
      amount: netChange,
      isDerived: true
    });
  } catch (err) {
    console.error("Balance calculation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
