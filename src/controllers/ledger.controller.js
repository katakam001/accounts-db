const { getDb } = require("../utils/getDb");
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { uploadToS3 } = require("../services/s3Upload.service");

exports.getAccountCopy = async (req, res) => {
  const account_id = parseInt(req.params.accountId);
  const user_id = req.query.userId;
  const financial_year = req.query.financialYear;
  const startRow = parseInt(req.query.nextStartRow, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 10;
  const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
  const toDate = req.query.toDate ? new Date(req.query.toDate) : null;

  if (!user_id) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }

  if (!financial_year) {
    return res.status(400).json({ error: 'financialYear query parameter is required' });
  }

  try {
    const db = getDb();
    const endRow = startRow + pageSize + 1; // Adding a buffer of 1 record

    // Dynamically construct date filter conditions for both tables
    const dateFilterConditionsForJE = [];
    const dateFilterConditionsForCE = [];
    if (fromDate) {
      dateFilterConditionsForJE.push(`je.journal_date >= :fromDate`);
      dateFilterConditionsForCE.push(`ce.cash_date >= :fromDate`);
    }
    if (toDate) {
      dateFilterConditionsForJE.push(`je.journal_date <= :toDate`);
      dateFilterConditionsForCE.push(`ce.cash_date <= :toDate`);
    }
    const dateFilterSQLForJE = dateFilterConditionsForJE.length > 0 ? `AND ${dateFilterConditionsForJE.join(' AND ')}` : '';
    const dateFilterSQLForCE = dateFilterConditionsForCE.length > 0 ? `AND ${dateFilterConditionsForCE.join(' AND ')}` : '';

    const [entriesBuffer] = await db.sequelize.query(

      ` WITH combined_entries AS (
  -- Journal entries
  SELECT
    CAST(je.id AS VARCHAR) AS entry_id,
    DATE(je.journal_date) AS date,
    ji.narration,
    ji.amount,
    ji.type,
    ji.account_id,
    ji.group_id
  FROM public.journal_entries je
  JOIN public.journal_items ji ON je.id = ji.journal_id
  WHERE je.user_id = :user_id
    AND je.financial_year = :financial_year
    AND ji.account_id = :account_id
    ${dateFilterSQLForJE}

  UNION ALL

  -- Cash entries
  SELECT
    ce.unique_entry_id AS entry_id,
    DATE(ce.cash_date) AS date,
    ce.narration,
    ce.amount,
    ce.type,
    ce.account_id,
    ce.group_id
  FROM public.combined_cash_entries ce
  WHERE ce.user_id = :user_id
    AND ce.financial_year = :financial_year
    AND ce.account_id = :account_id
    ${dateFilterSQLForCE}
),

entries_with_names AS (
  SELECT
    ce.entry_id,
    ce.date,
    ce.narration,
    ce.amount,
    ce.type,
    ce.account_id,
    a.name AS account_name,
    ce.group_id,
    g.name AS group_name
  FROM combined_entries ce
  LEFT JOIN public.account_list a ON ce.account_id = a.id
  LEFT JOIN public.group_list g ON ce.group_id = g.id
  WHERE a.user_id = :user_id
    AND a.financial_year = :financial_year
    AND g.user_id = :user_id
    AND g.financial_year = :financial_year
),

numbered_entries AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, group_id 
      ORDER BY date
    ) AS inner_row,
    1 AS row_type_order,
    'entry' AS row_type,
    0 AS overall_debit,
    0 AS overall_credit
  FROM entries_with_names
),

opening_entries AS (
  SELECT
    'OPENING-' || al.id AS entry_id,
    DATE(:fromDate) AS date,
    'Opening Balance' AS narration,
    CASE 
      WHEN al.debit_balance > al.credit_balance THEN al.debit_balance - al.credit_balance
      ELSE al.credit_balance - al.debit_balance
    END AS amount,
    CASE 
      WHEN al.debit_balance > al.credit_balance THEN false
      ELSE true
    END AS type,
    al.id AS account_id,
    al.name AS account_name,
    ag.group_id,
    gl.name AS group_name,
    0 AS inner_row,
    0 AS row_type_order,
    'opening' AS row_type,
    0 AS overall_debit,
    0 AS overall_credit
  FROM account_list al
  JOIN account_group ag ON al.id = ag.account_id
  JOIN group_list gl ON ag.group_id = gl.id
  WHERE al.user_id = :user_id
    AND al.financial_year = :financial_year
    AND al.id = :account_id
),

combined_entry_stream AS (
  SELECT *, 0 AS opening_adjustment FROM opening_entries
  UNION ALL
  SELECT *, 0 AS opening_adjustment FROM numbered_entries
),

entries_with_balance AS (
  SELECT *,
    SUM(CASE WHEN type THEN amount ELSE -amount END)
      OVER (PARTITION BY account_id, group_id ORDER BY inner_row)
    + opening_adjustment AS balance
  FROM combined_entry_stream
),

summary_entries AS (
  SELECT
    'SUMMARY-' || account_id AS entry_id,
    DATE(:toDate) AS date,
    'Summary Total' AS narration,
    0 AS amount,
    true AS type,
    account_id,
    account_name,
    group_id,
    group_name,
    999999 AS inner_row,
    2 AS row_type_order,
    'summary' AS row_type,
    SUM(CASE WHEN NOT type THEN amount ELSE 0 END) AS overall_debit,
    SUM(CASE WHEN type THEN amount ELSE 0 END) AS overall_credit,
    0 AS opening_adjustment,
    SUM(CASE WHEN type THEN amount ELSE -amount END) AS balance
  FROM entries_with_balance
  GROUP BY account_id, account_name, group_id, group_name
)

-- Final unified rows with pagination
SELECT *
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      ORDER BY group_name, account_name, row_type_order, inner_row
    ) AS row_num
  FROM (
    SELECT * FROM entries_with_balance
    UNION ALL
    SELECT * FROM summary_entries
  ) AS combined
) AS final_ledger
WHERE row_num BETWEEN :startRow AND :endRow
ORDER BY row_num;
     `,
      {
        replacements: {
          account_id,
          user_id,
          financial_year,
          startRow,
          endRow,
          fromDate: fromDate ? fromDate.toISOString() : undefined,
          toDate: toDate ? toDate.toISOString() : undefined,
        }
      }
    );

    // Determine if there are more records
    const hasMoreRecords = entriesBuffer.length > pageSize;
    const validEntries = hasMoreRecords ? entriesBuffer.slice(0, pageSize) : entriesBuffer;

    // Prepare and send the result
    const groupedEntries = validEntries.map((entry) => ({
      entry_id: entry.entry_id,
      group_id: entry.group_id,
      group_name: entry.group_name,
      account_id: entry.account_id,
      account_name: entry.account_name,
      date: entry.date,
      narration: entry.narration,
      amount: parseFloat(entry.amount).toFixed(2),
      type: entry.type,
      balance: parseFloat(entry.balance).toFixed(2),
      row_type: entry.row_type,
      overall_debit: parseFloat(entry.overall_debit).toFixed(2),
      overall_credit: parseFloat(entry.overall_credit).toFixed(2),
    }));

    res.json({
      entries: groupedEntries,
      nextStartRow: startRow + groupedEntries.length, // Null if no more records
      hasMore: hasMoreRecords, // True if more records exist
    });
  } catch (error) {
    console.error('Error fetching account copy data:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getLedger = async (req, res) => {
  const user_id = req.query.userId;
  const financial_year = req.query.financialYear;
  const startRow = parseInt(req.query.nextStartRow, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 10;
  const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
  const toDate = req.query.toDate ? new Date(req.query.toDate) : null;

  if (!user_id) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }

  if (!financial_year) {
    return res.status(400).json({ error: 'financialYear query parameter is required' });
  }

  try {
    const db = getDb();
    const endRow = startRow + pageSize + 1; // Adding a buffer of 1 record

    // Dynamically construct date filter conditions for both tables
    const dateFilterConditionsForJE = [];
    const dateFilterConditionsForCE = [];
    if (fromDate) {
      dateFilterConditionsForJE.push(`je.journal_date >= :fromDate`);
      dateFilterConditionsForCE.push(`ce.cash_date >= :fromDate`);
    }
    if (toDate) {
      dateFilterConditionsForJE.push(`je.journal_date <= :toDate`);
      dateFilterConditionsForCE.push(`ce.cash_date <= :toDate`);
    }
    const dateFilterSQLForJE = dateFilterConditionsForJE.length > 0 ? `AND ${dateFilterConditionsForJE.join(' AND ')}` : '';
    const dateFilterSQLForCE = dateFilterConditionsForCE.length > 0 ? `AND ${dateFilterConditionsForCE.join(' AND ')}` : '';

    const [entriesBuffer] = await db.sequelize.query(
      `
WITH combined_entries AS (
  -- Journal entries
  SELECT
    CAST(je.id AS VARCHAR) AS entry_id,
    DATE(je.journal_date) AS date,
    ji.narration,
    ji.amount,
    ji.type,
    ji.account_id,
    ji.group_id
  FROM public.journal_entries je
  JOIN public.journal_items ji ON je.id = ji.journal_id
  WHERE je.user_id = :user_id AND je.financial_year = :financial_year
    ${dateFilterSQLForJE}

  UNION ALL

  -- Cash entries
  SELECT
    ce.unique_entry_id AS entry_id,
    DATE(ce.cash_date) AS date,
    ce.narration,
    ce.amount,
    ce.type,
    ce.account_id,
    ce.group_id
  FROM public.combined_cash_entries ce
  WHERE ce.user_id = :user_id AND ce.financial_year = :financial_year
    ${dateFilterSQLForCE}
),

entries_with_names AS (
  SELECT
    ce.entry_id,
    ce.date,
    ce.narration,
    ce.amount,
    ce.type,
    ce.account_id,
    a.name AS account_name,
    ce.group_id,
    g.name AS group_name
  FROM combined_entries ce
  LEFT JOIN public.account_list a ON ce.account_id = a.id
  LEFT JOIN public.group_list g ON ce.group_id = g.id
  WHERE a.user_id = :user_id AND a.financial_year = :financial_year
    AND g.user_id = :user_id AND g.financial_year = :financial_year
),

numbered_entries AS MATERIALIZED (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, group_id 
      ORDER BY date
    ) AS inner_row,
    1 AS row_type_order,
    'entry' AS row_type,
    0 AS overall_debit,
    0 AS overall_credit
  FROM entries_with_names
),

opening_entries AS (
  SELECT
    'OPENING-' || al.id AS entry_id,
    DATE(:fromDate) AS date,
    'Opening Balance' AS narration,
    CASE 
      WHEN al.debit_balance > al.credit_balance THEN al.debit_balance - al.credit_balance
      ELSE al.credit_balance - al.debit_balance
    END AS amount,
    CASE 
      WHEN al.debit_balance > al.credit_balance THEN false
      ELSE true
    END AS type,
    al.id AS account_id,
    al.name AS account_name,
    ag.group_id,
    gl.name AS group_name,
    0 AS inner_row,
    0 AS row_type_order,
    'opening' AS row_type,
    0 AS overall_debit,
    0 AS overall_credit
  FROM account_list al
  JOIN account_group ag ON al.id = ag.account_id
  JOIN group_list gl ON ag.group_id = gl.id
  WHERE al.user_id = :user_id AND al.financial_year = :financial_year
),

combined_entry_stream AS MATERIALIZED (
  SELECT
    *,
  0 AS opening_adjustment
  FROM opening_entries

  UNION ALL

  SELECT
    *,
    0 AS opening_adjustment
  FROM numbered_entries
),

entries_with_balance AS MATERIALIZED (
  SELECT *,
    SUM(CASE WHEN type THEN amount ELSE -amount END)
      OVER (PARTITION BY account_id, group_id ORDER BY inner_row)
    + opening_adjustment AS balance
  FROM combined_entry_stream
),

summary_entries AS (
  SELECT
    'SUMMARY-' || account_id AS entry_id,
    DATE(:toDate) AS date,
    'Summary Total' AS narration,
    0 AS amount,
    true AS type,
    account_id,
    account_name,
    group_id,
    group_name,
    999999 AS inner_row,
    2 AS row_type_order,
    'summary' AS row_type,
    SUM(CASE WHEN NOT type THEN amount ELSE 0 END) AS overall_debit,
    SUM(CASE WHEN type THEN amount ELSE 0 END) AS overall_credit,
    0 AS opening_adjustment,
    SUM(CASE WHEN type THEN amount ELSE -amount END) AS balance
  FROM entries_with_balance
  GROUP BY account_id, account_name, group_id, group_name
)

-- Final unified rows with pagination
SELECT *
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      ORDER BY group_name, account_name, row_type_order, inner_row
    ) AS row_num
  FROM (
    SELECT * FROM entries_with_balance
    UNION ALL
    SELECT * FROM summary_entries
  ) AS combined
) AS final_ledger
WHERE row_num BETWEEN :startRow AND :endRow
ORDER BY row_num;
     `,
      {
        replacements: {
          user_id,
          financial_year,
          startRow,
          endRow,
          fromDate: fromDate ? fromDate.toISOString() : undefined,
          toDate: toDate ? toDate.toISOString() : undefined,
        }
      }
    );

    // Determine if there are more records
    const hasMoreRecords = entriesBuffer.length > pageSize;
    const validEntries = hasMoreRecords ? entriesBuffer.slice(0, pageSize) : entriesBuffer;

    // Prepare and send the result
    const groupedEntries = validEntries.map((entry) => ({
      entry_id: entry.entry_id,
      group_id: entry.group_id,
      group_name: entry.group_name,
      account_id: entry.account_id,
      account_name: entry.account_name,
      date: entry.date,
      narration: entry.narration,
      amount: parseFloat(entry.amount).toFixed(2),
      type: entry.type,
      balance: parseFloat(entry.balance).toFixed(2),
      row_type: entry.row_type,
      overall_debit: parseFloat(entry.overall_debit).toFixed(2),
      overall_credit: parseFloat(entry.overall_credit).toFixed(2),
    }));

    res.json({
      entries: groupedEntries,
      nextStartRow: startRow + groupedEntries.length, // Null if no more records
      hasMore: hasMoreRecords, // True if more records exist
    });
  } catch (error) {
    console.error('Error fetching ledger data:', error);
    res.status(500).json({ error: error.message });
  }
};



exports.exportAccountCopyToPDF = async (req, res) => {

  const db = getDb();
  const Exports = db.exports;
  const Account = db.account;

  try {
    const accountId = req.query.accountId;
    const userId = req.query.userId;
    const financialYear = req.query.financialYear;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
    const companyName = req.query.companyName;
    const city = req.query.city;

    const pageSize = 1000;
    let startRow = 1;
    let hasMore = true;
    let fullLedger = [];
    // Step 1: Fetch account balance
    const account = await Account.findOne({
      where: { id: parseInt(accountId), user_id: userId, financial_year: financialYear }
    });
    // Paginate through all ledger entries
    while (hasMore) {
      const chunk = await getAccountCopyData(
        parseInt(accountId),
        userId,
        financialYear,
        startRow,
        pageSize,
        fromDate,
        toDate
      );
      fullLedger = fullLedger.concat(chunk.entries);
      hasMore = chunk.hasMore;
      startRow = chunk.nextStartRow;
    }
    const inputKeyTimestamp = new Date().toISOString();

    // Step 2: Insert export record with status = 0 (DATA GENERATED)
    const exportRecord = await Exports.create({
      file_type: 'accountCopy',
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
      companyName,
      cityName: city,
      financialYear,
      accountName: account.name,
      fullLedger,
      startDate: req.query.fromDate,
      endDate: req.query.toDate
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
    const fileName = `accountCopy_${financialYear}_${Date.now()}.json`;

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
          fileType: 'accountCopy',
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

exports.exportLedgerToPDF = async (req, res) => {

  const db = getDb();
  const Exports = db.exports;

  try {
    const userId = req.query.userId;
    const financialYear = req.query.financialYear;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
    const companyName = req.query.companyName;
    const city = req.query.city;

    const fullLedger = await fetchFullLedger({
      userId,
      financialYear,
      fromDate,
      toDate
    });

    const filteredEntries = groupLedgerByAccount(fullLedger);

    const inputKeyTimestamp = new Date().toISOString();

    // Step 2: Insert export record with status = 0 (DATA GENERATED)
    const exportRecord = await Exports.create({
      file_type: 'ledger',
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
      companyName,
      cityName: city,
      financialYear,
      filteredEntries,
      startDate: req.query.fromDate,
      endDate: req.query.toDate
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
    const fileName = `ledger${financialYear}_${Date.now()}.json`;

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
          fileType: 'ledger',
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

exports.exportToExcel = async (req, res) => {
  try {
    const { accountId, userId, financialYear } = req.query;
    const ledger = await getLedgerData(accountId, userId, financialYear); // Fetch ledger data based on accountId, userId, and financialYear
    const exportsDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ledger');
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Narration', key: 'narration', width: 30 },
      { header: 'Credit', key: 'credit', width: 15, style: { alignment: { horizontal: 'right' }, numFmt: '0.00' } },
      { header: 'Debit', key: 'debit', width: 15, style: { alignment: { horizontal: 'right' }, numFmt: '0.00' } },
      { header: 'Balance', key: 'balance', width: 15, style: { alignment: { horizontal: 'right' }, numFmt: '0.00' } }
    ];

    const thinBorder = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    ledger.forEach(entry => {
      const row = worksheet.addRow({
        date: entry.date,
        narration: entry.narration,
        credit: entry.credit ? parseFloat(entry.credit) : '',
        debit: entry.debit ? parseFloat(entry.debit) : '',
        balance: parseFloat(entry.balance)
      });

      row.eachCell(cell => {
        cell.border = thinBorder;
      });
    });

    const filePath = path.join(exportsDir, `ledger_${userId}_${financialYear}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath);
  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


async function getLedgerChunk({ user_id, financial_year, startRow = 1, pageSize = 100, fromDate = null, toDate = null }) {

  try {
    const db = getDb();
    const endRow = startRow + pageSize + 1; // Adding a buffer of 1 record

    // Dynamically construct date filter conditions for both tables
    const dateFilterConditionsForJE = [];
    const dateFilterConditionsForCE = [];
    if (fromDate) {
      dateFilterConditionsForJE.push(`je.journal_date >= :fromDate`);
      dateFilterConditionsForCE.push(`ce.cash_date >= :fromDate`);
    }
    if (toDate) {
      dateFilterConditionsForJE.push(`je.journal_date <= :toDate`);
      dateFilterConditionsForCE.push(`ce.cash_date <= :toDate`);
    }
    const dateFilterSQLForJE = dateFilterConditionsForJE.length > 0 ? `AND ${dateFilterConditionsForJE.join(' AND ')}` : '';
    const dateFilterSQLForCE = dateFilterConditionsForCE.length > 0 ? `AND ${dateFilterConditionsForCE.join(' AND ')}` : '';

    const [entriesBuffer] = await db.sequelize.query(
      `
WITH combined_entries AS (
  -- Journal entries
  SELECT
    CAST(je.id AS VARCHAR) AS entry_id,
    DATE(je.journal_date) AS date,
    ji.narration,
    ji.amount,
    ji.type,
    ji.account_id,
    ji.group_id
  FROM public.journal_entries je
  JOIN public.journal_items ji ON je.id = ji.journal_id
  WHERE je.user_id = :user_id AND je.financial_year = :financial_year
    ${dateFilterSQLForJE}

  UNION ALL

  -- Cash entries
  SELECT
    ce.unique_entry_id AS entry_id,
    DATE(ce.cash_date) AS date,
    ce.narration,
    ce.amount,
    ce.type,
    ce.account_id,
    ce.group_id
  FROM public.combined_cash_entries ce
  WHERE ce.user_id = :user_id AND ce.financial_year = :financial_year
    ${dateFilterSQLForCE}
),

entries_with_names AS (
  SELECT
    ce.entry_id,
    ce.date,
    ce.narration,
    ce.amount,
    ce.type,
    ce.account_id,
    a.name AS account_name,
    ce.group_id,
    g.name AS group_name
  FROM combined_entries ce
  LEFT JOIN public.account_list a ON ce.account_id = a.id
  LEFT JOIN public.group_list g ON ce.group_id = g.id
  WHERE a.user_id = :user_id AND a.financial_year = :financial_year
    AND g.user_id = :user_id AND g.financial_year = :financial_year
),

numbered_entries AS MATERIALIZED (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, group_id 
      ORDER BY date
    ) AS inner_row,
    1 AS row_type_order,
    'entry' AS row_type,
    0 AS overall_debit,
    0 AS overall_credit
  FROM entries_with_names
),

opening_entries AS (
  SELECT
    'OPENING-' || al.id AS entry_id,
    DATE(:fromDate) AS date,
    'Opening Balance' AS narration,
    CASE 
      WHEN al.debit_balance > al.credit_balance THEN al.debit_balance - al.credit_balance
      ELSE al.credit_balance - al.debit_balance
    END AS amount,
    CASE 
      WHEN al.debit_balance > al.credit_balance THEN false
      ELSE true
    END AS type,
    al.id AS account_id,
    al.name AS account_name,
    ag.group_id,
    gl.name AS group_name,
    0 AS inner_row,
    0 AS row_type_order,
    'opening' AS row_type,
    0 AS overall_debit,
    0 AS overall_credit
  FROM account_list al
  JOIN account_group ag ON al.id = ag.account_id
  JOIN group_list gl ON ag.group_id = gl.id
  WHERE al.user_id = :user_id AND al.financial_year = :financial_year
),

combined_entry_stream AS MATERIALIZED (
  SELECT
    *,
  0 AS opening_adjustment
  FROM opening_entries

  UNION ALL

  SELECT
    *,
    0 AS opening_adjustment
  FROM numbered_entries
),

entries_with_balance AS MATERIALIZED (
  SELECT *,
    SUM(CASE WHEN type THEN amount ELSE -amount END)
      OVER (PARTITION BY account_id, group_id ORDER BY inner_row)
    + opening_adjustment AS balance
  FROM combined_entry_stream
),

summary_entries AS (
  SELECT
    'SUMMARY-' || account_id AS entry_id,
    DATE(:toDate) AS date,
    'Summary Total' AS narration,
    0 AS amount,
    true AS type,
    account_id,
    account_name,
    group_id,
    group_name,
    999999 AS inner_row,
    2 AS row_type_order,
    'summary' AS row_type,
    SUM(CASE WHEN NOT type THEN amount ELSE 0 END) AS overall_debit,
    SUM(CASE WHEN type THEN amount ELSE 0 END) AS overall_credit,
    0 AS opening_adjustment,
    SUM(CASE WHEN type THEN amount ELSE -amount END) AS balance
  FROM entries_with_balance
  GROUP BY account_id, account_name, group_id, group_name
)

-- Final unified rows with pagination
SELECT *
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      ORDER BY group_name, account_name, row_type_order, inner_row
    ) AS row_num
  FROM (
    SELECT * FROM entries_with_balance
    UNION ALL
    SELECT * FROM summary_entries
  ) AS combined
) AS final_ledger
WHERE row_num BETWEEN :startRow AND :endRow
ORDER BY row_num;
     `,
      {
        replacements: {
          user_id,
          financial_year,
          startRow,
          endRow,
          fromDate: fromDate ? fromDate.toISOString() : undefined,
          toDate: toDate ? toDate.toISOString() : undefined,
        }
      }
    );

    // Determine if there are more records
    const hasMoreRecords = entriesBuffer.length > pageSize;
    const validEntries = hasMoreRecords ? entriesBuffer.slice(0, pageSize) : entriesBuffer;

    // Prepare and send the result
    const groupedEntries = validEntries.map((entry) => ({
      account_id: entry.account_id,
      account_name: entry.account_name,
      date: formatDate(entry.date),
      narration: entry.narration,
      amount: parseFloat(entry.amount).toFixed(2),
      type: entry.type,
      balance: parseFloat(entry.balance).toFixed(2),
      row_type: entry.row_type,
      overall_debit: parseFloat(entry.overall_debit).toFixed(2),
      overall_credit: parseFloat(entry.overall_credit).toFixed(2),
    }));

    return {
      entries: groupedEntries,
      nextStartRow: startRow + groupedEntries.length, // Null if no more records
      hasMore: hasMoreRecords, // True if more records exist
    };
  } catch (error) {
    console.error('Error fetching ledger data:', error);
  }
};

function formatDate(date) {
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
}

async function getAccountCopyData(account_id, user_id, financial_year, startRow = 1, pageSize = 100, fromDate = null, toDate = null) {

  try {
    const db = getDb();
    const endRow = startRow + pageSize + 1; // Adding a buffer of 1 record

    // Dynamically construct date filter conditions for both tables
    const dateFilterConditionsForJE = [];
    const dateFilterConditionsForCE = [];
    if (fromDate) {
      dateFilterConditionsForJE.push(`je.journal_date >= :fromDate`);
      dateFilterConditionsForCE.push(`ce.cash_date >= :fromDate`);
    }
    if (toDate) {
      dateFilterConditionsForJE.push(`je.journal_date <= :toDate`);
      dateFilterConditionsForCE.push(`ce.cash_date <= :toDate`);
    }
    const dateFilterSQLForJE = dateFilterConditionsForJE.length > 0 ? `AND ${dateFilterConditionsForJE.join(' AND ')}` : '';
    const dateFilterSQLForCE = dateFilterConditionsForCE.length > 0 ? `AND ${dateFilterConditionsForCE.join(' AND ')}` : '';

    const [entriesBuffer] = await db.sequelize.query(

      ` WITH combined_entries AS (
  -- Journal entries
  SELECT
    CAST(je.id AS VARCHAR) AS entry_id,
    DATE(je.journal_date) AS date,
    ji.narration,
    ji.amount,
    ji.type,
    ji.account_id,
    ji.group_id
  FROM public.journal_entries je
  JOIN public.journal_items ji ON je.id = ji.journal_id
  WHERE je.user_id = :user_id
    AND je.financial_year = :financial_year
    AND ji.account_id = :account_id
    ${dateFilterSQLForJE}

  UNION ALL

  -- Cash entries
  SELECT
    ce.unique_entry_id AS entry_id,
    DATE(ce.cash_date) AS date,
    ce.narration,
    ce.amount,
    ce.type,
    ce.account_id,
    ce.group_id
  FROM public.combined_cash_entries ce
  WHERE ce.user_id = :user_id
    AND ce.financial_year = :financial_year
    AND ce.account_id = :account_id
    ${dateFilterSQLForCE}
),

entries_with_names AS (
  SELECT
    ce.entry_id,
    ce.date,
    ce.narration,
    ce.amount,
    ce.type,
    ce.account_id,
    a.name AS account_name,
    ce.group_id,
    g.name AS group_name
  FROM combined_entries ce
  LEFT JOIN public.account_list a ON ce.account_id = a.id
  LEFT JOIN public.group_list g ON ce.group_id = g.id
  WHERE a.user_id = :user_id
    AND a.financial_year = :financial_year
    AND g.user_id = :user_id
    AND g.financial_year = :financial_year
),

numbered_entries AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, group_id 
      ORDER BY date
    ) AS inner_row,
    1 AS row_type_order,
    'entry' AS row_type,
    0 AS overall_debit,
    0 AS overall_credit
  FROM entries_with_names
),

opening_entries AS (
  SELECT
    'OPENING-' || al.id AS entry_id,
    DATE(:fromDate) AS date,
    'Opening Balance' AS narration,
    CASE 
      WHEN al.debit_balance > al.credit_balance THEN al.debit_balance - al.credit_balance
      ELSE al.credit_balance - al.debit_balance
    END AS amount,
    CASE 
      WHEN al.debit_balance > al.credit_balance THEN false
      ELSE true
    END AS type,
    al.id AS account_id,
    al.name AS account_name,
    ag.group_id,
    gl.name AS group_name,
    0 AS inner_row,
    0 AS row_type_order,
    'opening' AS row_type,
    0 AS overall_debit,
    0 AS overall_credit
  FROM account_list al
  JOIN account_group ag ON al.id = ag.account_id
  JOIN group_list gl ON ag.group_id = gl.id
  WHERE al.user_id = :user_id
    AND al.financial_year = :financial_year
    AND al.id = :account_id
),

combined_entry_stream AS (
  SELECT *, 0 AS opening_adjustment FROM opening_entries
  UNION ALL
  SELECT *, 0 AS opening_adjustment FROM numbered_entries
),

entries_with_balance AS (
  SELECT *,
    SUM(CASE WHEN type THEN amount ELSE -amount END)
      OVER (PARTITION BY account_id, group_id ORDER BY inner_row)
    + opening_adjustment AS balance
  FROM combined_entry_stream
),

summary_entries AS (
  SELECT
    'SUMMARY-' || account_id AS entry_id,
    DATE(:toDate) AS date,
    'Summary Total' AS narration,
    0 AS amount,
    true AS type,
    account_id,
    account_name,
    group_id,
    group_name,
    999999 AS inner_row,
    2 AS row_type_order,
    'summary' AS row_type,
    SUM(CASE WHEN NOT type THEN amount ELSE 0 END) AS overall_debit,
    SUM(CASE WHEN type THEN amount ELSE 0 END) AS overall_credit,
    0 AS opening_adjustment,
    SUM(CASE WHEN type THEN amount ELSE -amount END) AS balance
  FROM entries_with_balance
  GROUP BY account_id, account_name, group_id, group_name
)

-- Final unified rows with pagination
SELECT *
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      ORDER BY group_name, account_name, row_type_order, inner_row
    ) AS row_num
  FROM (
    SELECT * FROM entries_with_balance
    UNION ALL
    SELECT * FROM summary_entries
  ) AS combined
) AS final_ledger
WHERE row_num BETWEEN :startRow AND :endRow
ORDER BY row_num;
     `,
      {
        replacements: {
          account_id,
          user_id,
          financial_year,
          startRow,
          endRow,
          fromDate: fromDate ? fromDate.toISOString() : undefined,
          toDate: toDate ? toDate.toISOString() : undefined,
        }
      }
    );

    // Determine if there are more records
    const hasMoreRecords = entriesBuffer.length > pageSize;
    const validEntries = hasMoreRecords ? entriesBuffer.slice(0, pageSize) : entriesBuffer;

    // Prepare and send the result
    const groupedEntries = validEntries.map((entry) => ({
      date: formatDate(entry.date),
      narration: entry.narration,
      amount: parseFloat(entry.amount).toFixed(2),
      type: entry.type,
      balance: parseFloat(entry.balance).toFixed(2),
      row_type: entry.row_type,
      overall_debit: parseFloat(entry.overall_debit).toFixed(2),
      overall_credit: parseFloat(entry.overall_credit).toFixed(2),
    }));

    return {
      entries: groupedEntries,
      nextStartRow: startRow + groupedEntries.length, // Null if no more records
      hasMore: hasMoreRecords, // True if more records exist
    };
  } catch (error) {
    console.error('Error fetching account copy data:', error);
  }
};

async function fetchFullLedger({ userId, financialYear, fromDate, toDate, pageSize = 1000 }) {
  let startRow = 1;
  let hasMore = true;
  const fullLedger = [];

  while (hasMore) {
    const response = await getLedgerChunk({
      user_id: userId,
      financial_year: financialYear,
      startRow,
      pageSize,
      fromDate,
      toDate
    });

    fullLedger.push(...response.entries);
    hasMore = response.hasMore;
    startRow = response.nextStartRow;
  }

  return fullLedger;
}

function groupLedgerByAccount(fullLedger) {
  const grouped = {};

  for (const entry of fullLedger) {
    const key = `${entry.account_id}::${entry.account_name}`;
    if (!grouped[key]) {
      grouped[key] = {
        accountId: entry.account_id,
        accountName: entry.account_name,
        entries: []
      };
    }
    grouped[key].entries.push(entry);
  }

  return Object.values(grouped); // → filteredEntries
}
