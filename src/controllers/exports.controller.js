const { getDb } = require("../utils/getDb");
const { Op } = require('sequelize');

exports.getAllExports = async (req, res) => {
  try {
    const db = getDb();
    const Export = db.exports;

    const userId = req.query.userId;
    const financialYear = req.query.financialYear;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
    // Extend toDate to end of day
    toDate.setHours(23, 59, 59, 999);

    const whereClause = {
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear }),
      input_key_timestamp: {
        [Op.between]: [fromDate, toDate]
      }
    };

    const exportsList = await Export.findAll({ where: whereClause });

    res.json(exportsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};