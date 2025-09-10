const { getDb } = require("../utils/getDb");

exports.getAllExports = async (req, res) => {
  try {
    const db = getDb();
    const Export = db.exports;

    const { userId, financialYear } = req.query;

    const whereClause = {
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear })
    };

    const exportsList = await Export.findAll({ where: whereClause });

    res.json(exportsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};