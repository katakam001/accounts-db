const { getDb } = require("../utils/getDb");

exports.getTrailBalance = async (req, res) => {
    const { userId, fromDate, toDate,financialYear } = req.body;

    const query = `
WITH JournalEntries AS (
    SELECT 
        id 
    FROM 
        journal_entries 
    WHERE 
        user_id = :userId 
        AND journal_date BETWEEN :fromDate AND :toDate
),
JournalItems AS (
    SELECT 
        ji.group_id,
        ji.account_id,
        ji.amount,
        ji.type
    FROM 
        journal_items ji
    JOIN 
        JournalEntries je ON ji.journal_id = je.id
),
CashEntries AS (
    SELECT 
        ce.group_id,
        ce.account_id,
        ce.amount,
        ce.type
    FROM 
        combined_cash_entries ce
    WHERE 
        ce.user_id = :userId 
        AND cash_date BETWEEN :fromDate AND :toDate
),
CombinedEntries AS (
    SELECT 
        group_id,
        account_id,
        amount,
        type
    FROM 
        JournalItems
    UNION ALL
    SELECT 
        group_id,
        account_id,
        amount,
        type
    FROM 
        CashEntries
),
OpeningBalances AS (
    SELECT 
        ag.group_id,
        al.id AS account_id,
        al.debit_balance AS opening_debit,
        al.credit_balance AS opening_credit
    FROM 
        account_list al
    JOIN 
        account_group ag ON al.id = ag.account_id
    WHERE 
        user_id = :userId  AND
        al.financial_year = :financialYear
),
CombinedWithOpeningBalances AS (
    SELECT 
        ce.group_id,
        ce.account_id,
        SUM(CASE WHEN ce.type THEN ce.amount ELSE 0 END) AS total_credit,
        SUM(CASE WHEN NOT ce.type THEN ce.amount ELSE 0 END) AS total_debit
    FROM 
        CombinedEntries ce
    GROUP BY 
        ce.group_id, ce.account_id
    UNION ALL
    SELECT 
        ob.group_id,
        ob.account_id,
        ob.opening_credit AS total_credit,
        ob.opening_debit AS total_debit
    FROM 
        OpeningBalances ob
),
GroupedItems AS (
    SELECT 
        CASE 
            WHEN g.name IN ('Sundry Debtors', 'Sundry Creditors') THEN g.id::text 
            ELSE g.id::text 
        END AS group_id,
        CASE 
            WHEN g.name IN ('Sundry Debtors', 'Sundry Creditors') THEN g.name 
            ELSE g.name 
        END AS group_name,
        CASE 
            WHEN g.name IN ('Sundry Debtors', 'Sundry Creditors') THEN NULL 
            ELSE al.id 
        END AS account_id,
        CASE 
            WHEN g.name IN ('Sundry Debtors', 'Sundry Creditors') THEN NULL 
            ELSE al.name 
        END AS account_name,
        SUM(cob.total_credit) AS total_credit,
        SUM(cob.total_debit) AS total_debit,
        SUM(cob.total_credit - cob.total_debit) AS balance
    FROM 
        CombinedWithOpeningBalances cob
    JOIN 
        group_list g ON cob.group_id = g.id
    LEFT JOIN 
        account_list al ON cob.account_id = al.id
    GROUP BY 
        CASE 
            WHEN g.name IN ('Sundry Debtors', 'Sundry Creditors') THEN g.id::text 
            ELSE g.id::text 
        END,
        CASE 
            WHEN g.name IN ('Sundry Debtors', 'Sundry Creditors') THEN g.name 
            ELSE g.name 
        END,
        CASE 
            WHEN g.name IN ('Sundry Debtors', 'Sundry Creditors') THEN NULL 
            ELSE al.id 
        END,
        CASE 
            WHEN g.name IN ('Sundry Debtors', 'Sundry Creditors') THEN NULL 
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
        WHEN group_name IN ('Sundry Debtors', 'Sundry Creditors') THEN 1 
        ELSE 0 
    END,
    group_name,
    account_id;    `;

    try {
        const db = getDb();
        const rawEntries = await db.sequelize.query(query, {
            replacements: { userId, fromDate, toDate,financialYear },
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
