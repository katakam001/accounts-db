const {getDb} = require("../utils/getDb");

exports.getTrailBalance = async (req, res) => {
    const { userId, fromDate, toDate, financialYear } = req.body;

    const query = `
      WITH JournalEntries AS (
          SELECT 
              id 
          FROM 
              journal_entries 
          WHERE 
              user_id = :userId 
              AND journal_date BETWEEN :fromDate AND :toDate
              AND financial_year = :financialYear
      ),
      JournalItems AS (
          SELECT 
              ji.journal_id,
              ji.group_id,
              ji.account_id,
              ji.amount,
              ji.type
          FROM 
              journal_items ji
          JOIN 
              JournalEntries je ON ji.journal_id = je.id
      ),
      GroupedItems AS (
          SELECT 
              CASE 
                  WHEN g.name IN ('Sundary Debtors', 'Sundary Creditors') THEN g.id::text 
                  ELSE g.id::text 
              END AS group_id,
              CASE 
                  WHEN g.name IN ('Sundary Debtors', 'Sundary Creditors') THEN g.name 
                  ELSE g.name 
              END AS group_name,
              CASE 
                  WHEN g.name IN ('Sundary Debtors', 'Sundary Creditors') THEN NULL 
                  ELSE al.id 
              END AS account_id,
              CASE 
                  WHEN g.name IN ('Sundary Debtors', 'Sundary Creditors') THEN NULL 
                  ELSE al.name 
              END AS account_name,
              SUM(CASE WHEN ji.type THEN ji.amount ELSE 0 END) AS total_debit,
              SUM(CASE WHEN NOT ji.type THEN ji.amount ELSE 0 END) AS total_credit,
              SUM(CASE WHEN ji.type THEN ji.amount ELSE -ji.amount END) AS balance
          FROM 
              JournalItems ji
          JOIN 
              group_list g ON ji.group_id = g.id
          LEFT JOIN 
              account_list al ON ji.account_id = al.id
          GROUP BY 
              CASE 
                  WHEN g.name IN ('Sundary Debtors', 'Sundary Creditors') THEN g.id::text 
                  ELSE g.id::text 
              END,
              CASE 
                  WHEN g.name IN ('Sundary Debtors', 'Sundary Creditors') THEN g.name 
                  ELSE g.name 
              END,
              CASE 
                  WHEN g.name IN ('Sundary Debtors', 'Sundary Creditors') THEN NULL 
                  ELSE al.id 
              END,
              CASE 
                  WHEN g.name IN ('Sundary Debtors', 'Sundary Creditors') THEN NULL 
                  ELSE al.name 
              END
      )
      SELECT 
          group_id,
          group_name,
          account_id,
          account_name,
          COALESCE(total_debit, 0) AS total_debit,
          COALESCE(total_credit, 0) AS total_credit,
          COALESCE(balance, 0) AS balance
      FROM 
          GroupedItems
      ORDER BY 
          CASE 
              WHEN group_name IN ('Sundary Debtors', 'Sundary Creditors') THEN 1 
              ELSE 0 
          END,
          group_name,
          account_id;
    `;

    try {
        const db = getDb();
        const rawEntries = await db.sequelize.query(query, {
            replacements: { userId, fromDate, toDate, financialYear },
            type: db.sequelize.QueryTypes.SELECT,
        });

        // Format the data
        const formattedData = rawEntries.map(entry => ({
            groupId: entry.group_id,
            groupName: entry.group_name,
            accountId: entry.account_id,
            accountName: entry.account_name,
            totalDebit: entry.total_debit,
            totalCredit: entry.total_credit,
            balance: entry.balance
        }));

        res.json(formattedData);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Error executing query');
    }
};
