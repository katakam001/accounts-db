const { getDb } = require("../utils/getDb");
const pdf = require('pdf-creator-node');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

exports.getLedgerForAccount = async (req, res) => {
  try {
    const db = getDb();
    const accountId = parseInt(req.params.accountId);
    const rowCursor = parseInt(req.query.rowCursor) || 0;
    const limit = parseInt(req.query.limit) || 100;
    const userId = req.query.userId; // Assuming userId is passed as a query parameter
    const financialYear = req.query.financialYear; // Assuming financialYear is passed as a query parameter
    const previousBalance = parseFloat(req.query.previousBalance) || 0; // Fetch previous balance from query

    const query = `
      WITH combined_entries AS (
        SELECT
          DATE(je.journal_date) AS date,
          ji.narration,
          ji.amount,
          ji.type
        FROM
          public.journal_entries je
        JOIN
          public.journal_items ji ON je.id = ji.journal_id
        WHERE
          ji.account_id = :accountId AND
          je.user_id = :userId AND
          je.financial_year = :financialYear
        UNION ALL
        SELECT
          DATE(ce.cash_date) AS date,
          ce.narration,
          ce.amount,
          ce.type
        FROM
          public.combined_cash_entries ce
        WHERE
          ce.account_id = :accountId AND
          ce.user_id = :userId AND
          ce.financial_year = :financialYear
      ),
      numbered_entries AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY date) AS row_num
        FROM
          combined_entries
      )
      SELECT
        *
      FROM
        numbered_entries
      WHERE
        row_num > :rowCursor
      ORDER BY
        row_num
      LIMIT :limit + 1;  --Fetch one extra record to determine if there are more records
    `;

    const ledger = await db.sequelize.query(query, {
      replacements: { accountId, userId, financialYear, rowCursor, limit },
      type: db.sequelize.QueryTypes.SELECT
    });

    // Calculate running balance and format amounts with two decimal places
    let balance = previousBalance; // Start with the previous balance
    ledger.forEach(entry => {
      entry.amount = parseFloat(entry.amount).toFixed(2);
      if (entry.type) { // Assuming type is boolean
        balance += parseFloat(entry.amount);
        entry.credit = entry.amount;
        entry.debit = '';
      } else {
        balance -= parseFloat(entry.amount);
        entry.debit = entry.amount;
        entry.credit = '';
      }
      entry.balance = balance.toFixed(2);
    });

    // Determine if there are more records
    const hasMoreRecords = ledger.length > limit;
    if (hasMoreRecords) {
      ledger.pop(); // Remove the extra record
    }

    // Calculate next row cursor
    const nextRowCursor = ledger.length > 0 ? ledger[ledger.length - 1].row_num : null;

    // Get the last balance to pass it to the next request
    const lastBalance = ledger.length > 0 ? ledger[ledger.length - 1].balance : balance;

    // Send ledger, next row cursor, and hasMoreRecords to the front end
    res.json({ ledger: ledger, nextRowCursor, hasMoreRecords, lastBalance });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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
        SELECT
          CAST(je.id AS VARCHAR) as entry_id,
          DATE(je.journal_date) AS date,
          ji.narration,
          ji.amount,
          ji.type,
          ji.account_id,
          ji.group_id
        FROM
          public.journal_entries je
        JOIN
          public.journal_items ji ON je.id = ji.journal_id
        WHERE
          je.user_id = :user_id AND
          je.financial_year = :financial_year ${dateFilterSQLForJE}

        UNION ALL

        SELECT
          ce.unique_entry_id as entry_id,
          DATE(ce.cash_date) AS date,
          ce.narration,
          ce.amount,
          ce.type,
          ce.account_id,
          ce.group_id
        FROM
          public.combined_cash_entries ce
        WHERE
          ce.user_id = :user_id AND
          ce.financial_year = :financial_year ${dateFilterSQLForCE}
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
        FROM
          combined_entries ce
        LEFT JOIN
          public.group_list g ON ce.group_id = g.id
        LEFT JOIN
          public.account_list a ON ce.account_id = a.id
        WHERE
          g.user_id = :user_id AND
          g.financial_year = :financial_year AND
          a.user_id = :user_id AND
          a.financial_year = :financial_year
      ),
      numbered_entries AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY group_name, account_name, date) AS row_num
        FROM
          entries_with_names
      ),
      entries_with_balance AS (
        SELECT
          *,
          SUM(CASE WHEN type THEN amount ELSE -amount END) 
            OVER (PARTITION BY account_id ORDER BY row_num) AS balance
        FROM
          numbered_entries
      )
      SELECT *
      FROM entries_with_balance
      WHERE row_num BETWEEN :startRow AND :endRow
      ORDER BY group_name, account_name, row_num
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


exports.getUpdatedLedger = async (req, res) => {
  try {
    const db = getDb();
    const accountId = parseInt(req.params.accountId);
    const startTime = new Date(req.query.startTime); // Assuming startTime is passed as a query parameter
    const endTime = new Date(req.query.endTime); // Assuming endTime is passed as a query parameter
    const last10time = new Date(req.query.last10time); // Assuming last10time is passed as a query parameter
    const userId = req.query.userId; // Assuming userId is passed as a query parameter
    const financialYear = req.query.financialYear; // Assuming financialYear is passed as a query parameter

    const query = `
      WITH combined_entries AS (
        SELECT
          DATE(je.journal_date) AS date,
          ji.narration,
          ji.amount,
          ji.type
        FROM
          public.journal_entries je
        JOIN
          public.journal_items ji ON je.id = ji.journal_id
        WHERE
          ji.account_id = :accountId AND
          je.user_id = :userId AND
          je.financial_year = :financialYear AND
          je.journal_date BETWEEN :startTime AND :endTime AND 
          je."updatedAt" >= :last10time
        UNION ALL
        SELECT
          DATE(ce.cash_date) AS date,
          ce.narration,
          ce.amount,
          ce.type
        FROM
          public.combined_cash_entries ce
        WHERE
          ce.account_id = :accountId AND
          ce.user_id = :userId AND
          ce.financial_year = :financialYear AND
          ce.cash_date BETWEEN :startTime AND :endTime AND 
          ce."updatedAt" >= :last10time
      ),
      numbered_entries AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY date) AS row_num
        FROM
          combined_entries
      )
      SELECT
        *
      FROM
        numbered_entries
      ORDER BY
        row_num;
    `;

    const ledger = await db.sequelize.query(query, {
      replacements: { accountId, userId, financialYear, startTime, endTime, last10time },
      type: db.sequelize.QueryTypes.SELECT
    });

    // Format amounts with two decimal places
    ledger.forEach(entry => {
      entry.amount = parseFloat(entry.amount).toFixed(2);
      if (entry.type) { // Assuming type is boolean
        entry.credit = entry.amount;
        entry.debit = '';
      } else {
        entry.debit = entry.amount;
        entry.credit = '';
      }
    });

    res.json(ledger);
  } catch (error) {
    console.error('Error fetching updated ledger:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.exportToPDF = async (req, res) => {
  try {
    const { accountId, userId, financialYear } = req.query;
    const ledger = await getLedgerData(parseInt(accountId), userId, financialYear); // Fetch ledger data based on accountId, userId, and financialYear
    const exportsDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const html = `
      <html>
        <head>
          <style>
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border: 1px solid black;
              padding: 8px;
            }
            th {
              background-color: #f2f2f2;
              text-align: center;
            }
            .right-align {
              text-align: right;
            }
          </style>
        </head>
        <body>
          <h2>Ledger Report</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Narration</th>
                <th>Credit</th>
                <th>Debit</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${ledger.map(entry => `
                <tr>
                  <td>${entry.date}</td>
                  <td>${entry.narration}</td>
                  <td class="right-align">${entry.credit}</td>
                  <td class="right-align">${entry.debit}</td>
                  <td class="right-align">${entry.balance}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const options = {
      format: 'A4',
      orientation: 'portrait',
      border: '10mm',
      paginationOffset: 10,
      footer: {
        height: '20mm',
        contents: {
          default: '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>',
        },
      },
    };
    const document = {
      html: html,
      data: { ledger },
      path: path.join(exportsDir, `ledger_${userId}_${financialYear}.pdf`),
    };
    // Create PDF
    pdf.create(document, options)
      .then((result) => {
        res.download(result.filename);
      })
      .catch((error) => {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      });
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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


async function getLedgerData(accountId, userId, financialYear) {
  try {
    console.log(accountId);
    console.log(userId);
    console.log(financialYear);

    const db = getDb();
    const query = `
      WITH combined_entries AS (
        SELECT
          DATE(je.journal_date) AS date,
          ji.narration,
          ji.amount,
          ji.type
        FROM
          public.journal_entries je
        JOIN
          public.journal_items ji ON je.id = ji.journal_id
        WHERE
          ji.account_id = :accountId AND
          je.user_id = :userId AND
          je.financial_year = :financialYear
        UNION ALL
        SELECT
          DATE(ce.cash_date) AS date,
          ce.narration,
          ce.amount,
          ce.type
        FROM
          public.combined_cash_entries ce
        WHERE
          ce.account_id = :accountId AND
          ce.user_id = :userId AND
          ce.financial_year = :financialYear
      )
      SELECT
        *
      FROM
        combined_entries
      ORDER BY
        date;
    `;

    const ledger = await db.sequelize.query(query, {
      replacements: { accountId, userId, financialYear },
      type: db.sequelize.QueryTypes.SELECT
    });

    // Calculate running balance and format amount with two decimal places
    let balance = 0;
    ledger.forEach(entry => {
      entry.amount = parseFloat(entry.amount).toFixed(2);
      if (entry.type) { // Assuming type is boolean
        balance += parseFloat(entry.amount);
        entry.credit = entry.amount;
        entry.debit = '';
      } else {
        balance -= parseFloat(entry.amount);
        entry.debit = entry.amount;
        entry.credit = '';
      }
      entry.balance = balance.toFixed(2);
    });

    return ledger;
  } catch (error) {
    console.error('Error fetching ledger data:', error);
    throw error;
  }
}
