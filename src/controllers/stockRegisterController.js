const { Client } = require('pg');
const { getDb } = require("../utils/getDb");

exports.generateStockRegister = async (req, res) => {
  const user_id = parseInt(req.query.userId, 10);
  const financial_year = req.query.financialYear;
  const item_id = parseInt(req.query.itemId, 10); // Change to itemId
  
  if (isNaN(user_id)) {
    return res.status(400).json({ error: 'userId query parameter must be an integer' });
  }
  if (isNaN(item_id)) {
    return res.status(400).json({ error: 'itemId query parameter must be an integer' });
  }
  if (!financial_year) {
    return res.status(400).json({ error: 'financialYear query parameter is required' });
  }

  try {
    const db = getDb();
    const sequelize = db.sequelize;

    // Get the connection details from Sequelize
    const config = sequelize.config;

    // Create a new PostgreSQL client
    const client = new Client({
      user: config.username,
      host: config.host,
      database: config.database,
      password: config.password,
      port: config.port
    });

    await client.connect();

    // Listen for notice events
    client.on('notice', (msg) => {
      console.log('Notice:', msg.message);
    });

    // Call the stored procedure with the correct order of arguments
    await client.query('CALL generate_stock_register($1, $2, $3)', [item_id, user_id, financial_year]);

    console.log('Stored procedure executed successfully');

    // Run the query to get the result set
    const result = await client.query(`
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
        sr.financial_year = $1
        AND sr.user_id = $2
        AND sr.item_id = $3
      ORDER BY 
        sr.entry_date;
    `, [financial_year, user_id, item_id]);

    await client.end();

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
