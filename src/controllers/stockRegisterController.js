const { getDb } = require("../utils/getDb");

exports.generateStockRegister = async (req, res) => {
  const user_id = parseInt(req.query.userId, 10);
  const financial_year = req.query.financialYear;
  const item_id = parseInt(req.query.itemId, 10);
  const month = req.query.month ? parseInt(req.query.month, 10) : null;

  if (isNaN(user_id) || isNaN(item_id) || !financial_year) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }

  try {
    const db = getDb();
    const sequelize = db.sequelize;

    // ✅ Call stored procedure
    await sequelize.query(
      `CALL generate_stock_register(:item_id, :user_id, :financial_year)`,
      {
        replacements: { item_id, user_id, financial_year }
      }
    );

    // ✅ Build query with optional month filter
    const baseQuery = `
      SELECT 
        sr.entry_date AS "Date",
        i.name AS "Item",
        sr.opening_balance AS "Opening Stock",
        sr.purchase AS "Purchase",
        sr.sale_return AS "Sale Return",
        sr.received_from_process AS "Received From Process",
        (sr.opening_balance + sr.purchase + sr.sale_return + sr.received_from_process) AS "Total",
        sr.sales AS "Sales",
        sr.purchase_return AS "Purchase Return",
        sr.dispatch_to_process AS "Dispatch To Process",
        sr.closing_balance AS "Closing Stock"
      FROM 
        public.stock_register sr
      JOIN 
        public.items i ON sr.item_id = i.id
      WHERE 
        sr.financial_year = :financial_year
        AND sr.user_id = :user_id
        AND sr.item_id = :item_id
        ${month ? 'AND EXTRACT(MONTH FROM sr.entry_date) = :month' : ''}
      ORDER BY 
        sr.entry_date;
    `;

    const [rows] = await sequelize.query(baseQuery, {
      replacements: { financial_year, user_id, item_id, ...(month && { month }) }
    });

    // ✅ Return full-year data
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error executing stock register:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
