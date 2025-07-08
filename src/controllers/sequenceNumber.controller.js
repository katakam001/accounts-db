const { getDb } = require("../utils/getDb");

exports.getEntriesSNo = async (req, res) => {
  try {
    const db = getDb();
    const InvoiceTracker = db.invoice_tracker; // Replace 'your_table' with your actual table name
    const { userId, financialYear, type } = req.query;
    
    const whereClause = {
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear }),
      ...(type && { type: type })
    };
    
    const record = await InvoiceTracker.findOne({ where: whereClause });

    res.json({ last_sNo: record?.last_sno || 0 });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
