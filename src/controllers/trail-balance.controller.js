const { getDb } = require("../utils/getDb");
const { uploadToS3 } = require("../services/s3Upload.service");

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

exports.exportTrailBalanceToPDF = async (req, res) => {
    const userId = req.query.userId;
    const financialYear = req.query.financialYear;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
    const companyName = req.query.companyName;
    const city = req.query.city;
    const db = getDb();
    const Exports = db.exports;


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
        g.id::text AS group_id,
        g.name AS group_name,
        al.id AS account_id,
        al.name AS account_name,
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
        g.id, g.name, al.id, al.name
)
SELECT 
    group_name,
    account_name,
    COALESCE(balance, 0) AS balance
FROM 
    GroupedItems
ORDER BY 
    group_name,
    account_name;    `;

    try {
        const rawEntries = await db.sequelize.query(query, {
            replacements: { userId, fromDate, toDate, financialYear },
            type: db.sequelize.QueryTypes.SELECT,
        });

        // Format the data
        const formattedData = rawEntries.map(entry => ({
            groupName: entry.group_name,
            accountName: entry.account_name,
            balance: entry.balance
        }));

        const { groupedAccounts, totalDebit, totalCredit } = transformTrialBalanceRows(formattedData);

        const inputKeyTimestamp = new Date().toISOString();

        // Step 2: Insert export record with status = 0 (DATA GENERATED)
        const exportRecord = await Exports.create({
            file_type: 'trailBalance',
            financial_year: financialYear,
            status: 0,
            user_id: userId,
            input_key: '',
            input_key_timestamp: inputKeyTimestamp,
            output_key: '',
            output_key_timestamp: null
        });

        const exportId = exportRecord.id;

        const data = {
            userId,
            financialYear,
            companyName,
            cityName: city,
            reportDate: getFinancialYearEndDate(financialYear),
            totalDebit,
            totalCredit,
            groupedAccounts,
        };

        const buffer = Buffer.from(JSON.stringify(data));

        const fileSize = buffer.length; // Get size in bytes

        // Determine size tier
        let sizeTier = "small"; // default
        if (fileSize > 1024 * 1024 * 2.00) {
            sizeTier = "large";
        } else if (fileSize > 1024 * 1024 * 1.0) {
            sizeTier = "medium";
        }

        // Construct prefix with size tier
        const keyPrefix = `pdf-inputs/${sizeTier}/${userId}/`;
        const fileName = `trailBalance_${financialYear}_${Date.now()}.json`;

        // Step 3: Upload to S3
        let s3Key;
        try {
            s3Key = await uploadToS3({
                keyPrefix, fileName,
                dataBuffer: buffer,
                contentType: 'application/json',
                metadata: {
                    exportId: exportId.toString(),
                    userId: userId.toString(),
                    fileType: 'trailBalance',
                    financialYear,
                    generatedAt: inputKeyTimestamp
                }
            });
        } catch (uploadErr) {
            console.error('❌ S3 upload failed:', uploadErr);
            await exportRecord.update({ status: 5 }); // S3 INPUT KEY UPLOAD FAILED
            return res.status(500).json({ error: 'Failed to upload input file to S3.' });
        }

        // Step 4: Update export record with input key and status = 1 (INTRANSIT)
        await exportRecord.update({
            input_key: s3Key,
            status: 1
        });

        console.log(`✅ Uploaded to S3 at ${s3Key}`);
        res.status(200).send({ message: 'PDF input data successfully uploaded to S3 and tracked.' });

    } catch (err) {
        console.error('❌ Data generation failed:', err);
        // If exportRecord exists, mark as failed
        if (typeof exportRecord !== 'undefined') {
            await exportRecord.update({ status: 4 }); // DATA GENERATION FAILED
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

function transformTrialBalanceRows(rows) {
    const grouped = {};

    rows.forEach(row => {
        const { groupName, accountName, balance } = row;
        const amount = Math.abs(balance);
        const isCredit = balance > 0;

        if (!grouped[groupName]) {
            grouped[groupName] = [];
        }

        grouped[groupName].push({
            accountName,
            debit: isCredit ? 0 : amount,
            credit: isCredit ? amount : 0
        });
    });

    const groupedAccounts = Object.entries(grouped).map(([groupName, accounts]) => ({
        groupName,
        accounts
    }));

    const totalDebit = groupedAccounts.flatMap(g => g.accounts).reduce((sum, acc) => sum + acc.debit, 0);
    const totalCredit = groupedAccounts.flatMap(g => g.accounts).reduce((sum, acc) => sum + acc.credit, 0);

    return { groupedAccounts, totalDebit, totalCredit };
}

function getFinancialYearEndDate(financialYear) {
    const [, endYear] = financialYear.split("-");
    return `${endYear}-03-31`;
}

exports.getAccountsForGroupForTrailBalance = async (req, res) => {
    const { groupId, userId, fromDate, toDate, financialYear } = req.body;

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
    g.id::text AS group_id,
    g.name AS group_name,
    al.id AS account_id,
    al.name AS account_name,
        SUM(cob.total_credit) AS total_credit,
        SUM(cob.total_debit) AS total_debit,
        SUM(cob.total_credit - cob.total_debit) AS balance
    FROM 
        CombinedWithOpeningBalances cob
    JOIN 
        group_list g ON cob.group_id = g.id
    LEFT JOIN 
        account_list al ON cob.account_id = al.id
    WHERE g.id = :groupId  -- 🔍 Only fetch accounts under the clicked group
    GROUP BY 
g.id,
g.name, 
al.id,
al.name 
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
account_name;    `;

    try {
        const db = getDb();
        const rawEntries = await db.sequelize.query(query, {
            replacements: { groupId, userId, fromDate, toDate, financialYear },
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
