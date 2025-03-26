const { getDb } = require("../utils/getDb");
const { broadcast } = require('../websocket'); // Import the broadcast function
const pdf = require('pdf-creator-node');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const moment = require('moment'); // Add moment.js for date formatting
exports.combinedBookListForDayBook = async (req, res) => {
  try {
    const db = getDb();
    const userid = req.query.userId;
    const financial_year = req.query.financialYear;
    const limit = parseInt(req.query.limit) || 100;
    const rowCursor = parseInt(req.query.rowCursor) || 0;

    const combinedQuery = `
      -- Fetch records from journal_entries and combined_cash_entries within the financial year
      WITH combined_entries AS (
        SELECT
          DATE(je.journal_date) AS date,
          je.id AS id,
          ji.narration AS description,
          je."type" AS entry_type,
          ji.account_id,
          ji.amount,
          ji.type,
          COALESCE(je."invoiceNumber", CAST(je.id AS VARCHAR)) AS entry_id
        FROM
          public.journal_entries je
        JOIN
          public.journal_items ji ON je.id = ji.journal_id
        WHERE
          je.user_id = :userid AND
          je.financial_year = :financial_year
        UNION ALL
        SELECT
          DATE(ce.cash_date) AS date,
          ce.id AS id,
          ce.narration AS description,
          7 AS entry_type,
          ce.account_id,
          ce.amount,
          ce."type",
          unique_entry_id AS entry_id
        FROM
          public.combined_cash_entries ce
        WHERE
          ce.user_id = :userid AND
          ce.financial_year = :financial_year
      ),
      numbered_entries AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY date, id) AS row_num
        FROM
          combined_entries
      )
      -- Combine and sort the results
      SELECT
        *
      FROM
        numbered_entries
      WHERE
        row_num > :rowCursor
      ORDER BY
        row_num
      LIMIT :limit + 100; -- Fetch additional records to handle date splitting
    `;

    const replacements = { userid, financial_year, limit, rowCursor };

    const combinedResult = await db.sequelize.query(combinedQuery, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT
    });

    // console.log(combinedResult);

    // Group records by date
    const groupedEntries = combinedResult.reduce((acc, entry) => {
      if (!acc[entry.date]) {
        acc[entry.date] = [];
      }
      acc[entry.date].push(entry);
      return acc;
    }, {});

    // Flatten grouped entries and trim to fit within the limit
    const paginatedEntries = [];
    let count = 0;
    let hasNextPage = false;
    for (const date in groupedEntries) {
      if (count + groupedEntries[date].length > limit) {
        // If a single date has more than 100 records, include all records for that date
        if (groupedEntries[date].length > limit) {
          paginatedEntries.push(...groupedEntries[date]);
          count += groupedEntries[date].length;
        } else {
          hasNextPage = true;
        }
        break;
      }
      paginatedEntries.push(...groupedEntries[date]);
      count += groupedEntries[date].length;
    }

    // Check if there are remaining records for the last date
    if (combinedResult.length > paginatedEntries.length) {
      hasNextPage = true;
    }

    // Extract rowCursor from the last record
    const nextRowCursor = paginatedEntries.length > 0 ? paginatedEntries[paginatedEntries.length - 1].row_num : null;

    res.json({ entries: paginatedEntries, nextRowCursor, hasNextPage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function fetchBatchEntries(userid, financial_year, limit, rowCursor) {
  const db = getDb();
  const combinedQuery = `
    -- Fetch records from journal_entries and combined_cash_entries within the financial year
    WITH combined_entries AS (
      SELECT
        DATE(je.journal_date) AS date,
        je.id AS id,
        ji.narration AS description,
        je."type" AS entry_type,
        ji.account_id,
        ji.amount,
        ji.type,
        COALESCE(je."invoiceNumber", CAST(je.id AS VARCHAR)) AS entry_id,
        al.name AS particular
      FROM
        public.journal_entries je
      JOIN
        public.journal_items ji ON je.id = ji.journal_id
      JOIN
        public.account_list al ON ji.account_id = al.id
      WHERE
        je.user_id = :userid AND
        je.financial_year = :financial_year
      UNION ALL
      SELECT
        DATE(ce.cash_date) AS date,
        ce.id AS id,
        ce.narration AS description,
        7 AS entry_type,
        ce.account_id,
        ce.amount,
        ce."type",
        unique_entry_id AS entry_id,
        al.name AS particular
      FROM
        public.combined_cash_entries ce
      JOIN
        public.account_list al ON ce.account_id = al.id
      WHERE
        ce.user_id = :userid AND
        ce.financial_year = :financial_year
    ),
    numbered_entries AS (
      SELECT
        *,
        ROW_NUMBER() OVER (ORDER BY date, id) AS row_num
      FROM
        combined_entries
    )
    -- Combine and sort the results
    SELECT
      *
    FROM
      numbered_entries
    WHERE
      row_num > :rowCursor
    ORDER BY
      row_num
    LIMIT :limit + 100; -- Fetch additional records to handle date splitting
  `;

  const replacements = { userid, financial_year, limit, rowCursor };

  const combinedResult = await db.sequelize.query(combinedQuery, {
    replacements,
    type: db.sequelize.QueryTypes.SELECT
  });

  return combinedResult;
}

async function batchProcessingForDayBook(userid, financial_year, limit, rowCursor) {
  let combinedResult = [];
  let hasNextPage = false;
  let nextRowCursor = rowCursor;

  while (true) {
    const batchEntries = await fetchBatchEntries(userid, financial_year, limit, nextRowCursor);
    if (batchEntries.length === 0) {
      break;
    }

    combinedResult = combinedResult.concat(batchEntries);
    nextRowCursor = batchEntries[batchEntries.length - 1].row_num;

    if (combinedResult.length >= limit) {
      hasNextPage = true;
      break;
    }
  }

  // Group records by date
  const groupedEntries = combinedResult.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    acc[entry.date].push(entry);
    return acc;
  }, {});

  // Flatten grouped entries and trim to fit within the limit
  const paginatedEntries = [];
  let count = 0;
  for (const date in groupedEntries) {
    if (count + groupedEntries[date].length > limit) {
      // If a single date has more than 100 records, include all records for that date
      if (groupedEntries[date].length > limit) {
        paginatedEntries.push(...groupedEntries[date]);
        count += groupedEntries[date].length;
      } else {
        hasNextPage = true;
      }
      break;
    }
    paginatedEntries.push(...groupedEntries[date]);
    count += groupedEntries[date].length;
  }

  // Check if there are remaining records for the last date
  const lastDate = Object.keys(groupedEntries).pop();
  if (groupedEntries[lastDate] && groupedEntries[lastDate].length > count) {
    hasNextPage = true;
  }

  nextRowCursor = paginatedEntries.length > 0 ? paginatedEntries[paginatedEntries.length - 1].row_num : null;

  return { entries: paginatedEntries, nextRowCursor, hasNextPage };
}

async function processData(daybookEntries,lastPageBalance) {
  let totalCashCredit = 0;
  let totalJournalCredit = 0;
  let totalJournalDebit = 0;
  let totalCashDebit = 0;
  let processedEntries = [];

  for (const entry of daybookEntries) {
    const amount = parseFloat(entry.amount);

    const cashCredit = entry.entry_type === 7 && entry.type ? amount : 0;
    const cashDebit = entry.entry_type === 7 && !entry.type ? amount : 0;
    const journalCredit = entry.entry_type >= 0 && entry.entry_type <= 6 && entry.type ? amount : 0;
    const journalDebit = entry.entry_type >= 0 && entry.entry_type <= 6 && !entry.type ? amount : 0;

    totalCashCredit += cashCredit;
    totalCashDebit += cashDebit;
    totalJournalCredit += journalCredit;
    totalJournalDebit += journalDebit;

    processedEntries.push({
      id: entry.entry_type === 7 ? entry.id : entry.entry_id,
      date: entry.date,
      cashCredit,
      journalCredit,
      particular: entry.particular,
      account_id: entry.account_id,
      journalDebit,
      cashDebit,
      type: entry.entry_type
    });
  }

  // Sort entries by date
  processedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Group entries by date
  const groupedEntries = groupByDate(processedEntries);

  if (lastPageBalance && processedEntries.length > 0) {
    const firstDate = Object.keys(groupedEntries)[0];
    groupedEntries[firstDate].unshift({
        date: firstDate,
        cashCredit: lastPageBalance, // Use the carry-forward balance from the previous page
        journalCredit: 0,
        particular: 'Opening Balance',
        journalDebit: 0,
        cashDebit: 0
    });
}

  // Calculate totals and balance carry forward for each day
  const groupedDayBookEntries = Object.keys(groupedEntries).map((date, index, array) => {
    const entries = groupedEntries[date];
    const totalCashCredit = parseFloat(entries.reduce((sum, entry) => sum + entry.cashCredit, 0)).toFixed(2);
    const totalJournalCredit = parseFloat(entries.reduce((sum, entry) => sum + entry.journalCredit, 0)).toFixed(2);
    const totalJournalDebit = parseFloat(entries.reduce((sum, entry) => sum + entry.journalDebit, 0)).toFixed(2);
    const totalCashDebit = parseFloat(entries.reduce((sum, entry) => sum + entry.cashDebit, 0)).toFixed(2);
    const balanceCarryForward =  parseFloat((parseFloat(totalCashCredit) - parseFloat(totalCashDebit)).toFixed(2));
    const journalBalanceCarryForward = parseFloat((parseFloat(totalJournalCredit) - parseFloat(totalJournalDebit)).toFixed(2));

    // Add opening balance for the next day
    if (index < array.length - 1) {
      const nextDate = array[index + 1];
      groupedEntries[nextDate].unshift({
        date: nextDate,
        cashCredit: balanceCarryForward,
        journalCredit: 0,
        particular: 'Opening Balance',
        journalDebit: 0,
        cashDebit: 0
      });
    }

    return {
      date,
      entries,
      totalCashCredit,
      totalJournalCredit,
      totalJournalDebit,
      totalCashDebit,
      balanceCarryForward,
      journalBalanceCarryForward
    };
  });

  // Ensure groupedDayBookEntries exists and is non-empty before accessing
  const finalBalanceCarryForward = groupedDayBookEntries.length > 0
    ? groupedDayBookEntries[groupedDayBookEntries.length - 1].balanceCarryForward
    : 0;

  return {
    groupedDayBookEntries,
    finalBalanceCarryForward,
  };
}

function groupByDate(entries) {
  return entries.reduce((acc, entry) => {
    const date = entry.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {});
}

// Function to fetch daybook entries (replace with your actual data fetching logic)
const fetchDaybookEntries = async (userId, financialYear, limit, rowCursor) => {
  // Replace this with your actual data fetching logic
  const { entries, nextRowCursor, hasNextPage } = await batchProcessingForDayBook(userId, financialYear, limit, rowCursor);
  return { entries, nextRowCursor, hasNextPage };
};


exports.exportDaybookToExcel = async (req, res) => {
  try {
    const { userId, financialYear } = req.query;
    const db = getDb();
    const Account = db.account;
    const limit = 1000; // Define the batch size
    let rowCursor = 0;
    let hasNextPage = true;
    let lastPageBalance=0;
    const exportsDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filteredEntries = [];
    const account = await Account.findOne({ where: { name: 'CASH', user_id: userId, financial_year: financialYear } });
    lastPageBalance = parseFloat(account.debit_balance - account.credit_balance);

    while (hasNextPage) {
      const { entries, nextRowCursor, hasNextPage: nextPage } = await fetchDaybookEntries(userId, financialYear, limit, rowCursor);
      const { groupedDayBookEntries, finalBalanceCarryForward } = await processData(entries,lastPageBalance); // Destructure the returned object
      lastPageBalance = finalBalanceCarryForward; // Assign the final balance carry forward for the last page
      filteredEntries.push(...groupedDayBookEntries);
      rowCursor = nextRowCursor;
      hasNextPage = nextPage;
    }

    // Create a new workbook and add a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daybook');

    // Add data
    filteredEntries.forEach(day => {
      const formattedDate = moment(day.date).format('DD-MM-YYYY (dddd)'); // Format the date
      const startRow = worksheet.rowCount + 1; // Start row for the current date's data
      const dateRow = worksheet.addRow(['', '', formattedDate, '', '']); // Add formatted date row
      dateRow.getCell(3).alignment = { horizontal: 'center' }; // Center-align the formatted date
      worksheet.addRow(['Cash Credit', 'Journal Credit', 'Particular', 'Journal Debit', 'Cash Debit']);
      day.entries.forEach(entry => {
        worksheet.addRow([
          entry.cashCredit,
          entry.journalCredit,
          entry.particular,
          entry.journalDebit,
          entry.cashDebit,
        ]);
      });
      worksheet.addRow([
        day.totalCashCredit,
        day.totalJournalCredit,
        '',
        day.totalJournalDebit,
        day.totalCashDebit,
      ]);
      worksheet.addRow([
        day.totalCashDebit,
        day.totalJournalDebit,
        '',
        '',
        '',
      ]);
      worksheet.addRow([
        day.balanceCarryForward,
        day.journalBalanceCarryForward,
        'Balance Carry forward',
        '',
        '',
      ]);

      const endRow = worksheet.rowCount; // End row for the current date's data

      // Add thin borders to the table for the current date
      for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
        const row = worksheet.getRow(rowNum);
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }

      // Add thick borders around the entire range of the two specified rows
      const bottomthickBorderStyle = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thick' },
        right: { style: 'thin' }
      };

      const topthickBorderStyle = {
        top: { style: 'thick' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      const totalRows = [endRow - 2, endRow - 1]; // Rows with totals
      const firstRow = totalRows[0];
      const lastRow = totalRows[1];

      // Apply thick border around the entire range
      for (let col = 1; col <= 5; col++) {
        worksheet.getCell(startRow + 1, 3).border = {
          top: topthickBorderStyle.top,
          left: topthickBorderStyle.left,
          bottom: topthickBorderStyle.bottom,
          right: topthickBorderStyle.right
        };
        worksheet.getCell(startRow + 2, col).border = {
          top: topthickBorderStyle.top,
          left: topthickBorderStyle.left,
          bottom: topthickBorderStyle.bottom,
          right: topthickBorderStyle.right
        };
        worksheet.getCell(firstRow, col).border = {
          top: topthickBorderStyle.top,
          left: topthickBorderStyle.left,
          bottom: topthickBorderStyle.bottom,
          right: topthickBorderStyle.right
        };
        worksheet.getCell(lastRow, col).border = {
          top: bottomthickBorderStyle.top,
          left: bottomthickBorderStyle.left,
          right: bottomthickBorderStyle.right,
          bottom: bottomthickBorderStyle.bottom,
        };
        worksheet.getCell(endRow, col).border = {
          top: bottomthickBorderStyle.top,
          left: bottomthickBorderStyle.left,
          right: bottomthickBorderStyle.right,
          bottom: bottomthickBorderStyle.bottom,
        };
      }
    });

    // Set column widths
    worksheet.columns = [
      { width: 15 }, // Cash Credit
      { width: 15 }, // Journal Credit
      { width: 30 }, // Particular
      { width: 15 }, // Journal Debit
      { width: 15 }, // Cash Debit
    ];

    // Write the workbook to a file
    const filePath = path.join(exportsDir, `daybook_${userId}_${financialYear}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    res.download(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.exportDaybookToPDF = async (req, res) => {
  try {
    const { userId, financialYear } = req.query;
    const limit = 1000; // Define the batch size
    const db = getDb();
    const Account = db.account;
    const rowsPerPage = 40; // Define the number of rows per page
    let rowCursor = 0;
    let hasNextPage = true;
    let lastPageBalance=0;


    const exportsDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filteredEntries = [];
    const account = await Account.findOne({ where: { name: 'CASH', user_id: userId, financial_year: financialYear } });
    lastPageBalance = parseFloat(account.debit_balance - account.credit_balance);

    while (hasNextPage) {
      const { entries, nextRowCursor, hasNextPage: nextPage } = await fetchDaybookEntries(userId, financialYear, limit, rowCursor);
      const { groupedDayBookEntries, finalBalanceCarryForward } = await processData(entries,lastPageBalance); // Destructure the returned object
      lastPageBalance = finalBalanceCarryForward; // Assign the final balance carry forward for the last page
      filteredEntries.push(...groupedDayBookEntries);
      rowCursor = nextRowCursor;
      hasNextPage = nextPage;
    }



    // Read HTML Template
    const html = fs.readFileSync(path.join(__dirname, 'templates', 'template.html'), 'utf8');

    const data = {
      userId: userId,
      financialYear: financialYear,
      filteredEntries: filteredEntries,
    };

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
      data: data,
      path: path.join(exportsDir, `daybook_${userId}_${financialYear}.pdf`),
      type: '',
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getJournalEntries = async (req, res) => {
  try {
    const db = getDb();
    const userId = req.query.userId;
    const financialYear = req.query.financialYear;
    const accountId = req.query.accountId || null;
    const groupId = req.query.groupId || null;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const startRow = parseInt(req.query.nextStartRow) || 1;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }
    if (!financialYear) {
      return res.status(400).json({ error: 'financialYear query parameter is required' });
    }

    const whereClause = `
      WHERE je.user_id = :userId
      AND je.financial_year = :financialYear
      ${accountId ? "AND ji.account_id = :accountId" : ""}
      ${groupId ? "AND ji.group_id = :groupId" : ""}
    `;

    // Fetch raw entries with ROW_NUMBER() and pagination
    const [rawEntries] = await db.sequelize.query(
      `
      WITH NumberedEntries AS (
        SELECT
          je.id,
          je.journal_date,
          ji.narration,
          ji.journal_id,
          ji.account_id,
          ji.group_id,
          ji.amount,
          ji.type,
          ROW_NUMBER() OVER (ORDER BY je.journal_date, je.id) AS row_num
        FROM
          journal_entries je
        LEFT JOIN
          journal_items ji ON je.id = ji.journal_id
        ${whereClause}
      )
      SELECT
        id,
        journal_date,
        narration,
        journal_id,
        account_id,
        group_id,
        amount,
        type
      FROM NumberedEntries
      WHERE row_num BETWEEN :startRow AND :endRow
      `,
      {
        replacements: {
          userId,
          financialYear,
          accountId,
          groupId,
          startRow: startRow,
          endRow: startRow + pageSize + 10   // Fetch the records for the current page plus extra 10 records
        }
      }
    );

    const journalEntries = {};
    const orderedJournalIds = [];
    const lastJournalId = rawEntries[rawEntries.length - 1]?.journal_id;
    const completedEntries = [];
    let journalItemCount = 0;

    rawEntries.forEach(entry => {
      if (!journalEntries[entry.journal_id]) {
        journalEntries[entry.journal_id] = {
          id: entry.id,
          journal_date: entry.journal_date,
          items: []
        };
        orderedJournalIds.push(entry.journal_id); // Store the order of journal IDs
      }
      journalEntries[entry.journal_id].items.push({
        journal_id: entry.journal_id,
        account_id: entry.account_id,
        group_id: entry.group_id,
        narration: entry.narration,
        amount: entry.amount,
        type: entry.type
      });
    });

    // Iterate over orderedJournalIds array to maintain insertion order
    orderedJournalIds.forEach(journalId => {
      const entry = journalEntries[journalId];
      // Ensure complete entries are added except for the last journal entry
      if (journalId !== lastJournalId) {
        completedEntries.push(entry);
        journalItemCount += entry.items.length;
      }
    });

    // Include lastJournalId if rawEntries.length <= pageSize
    if (rawEntries.length <= pageSize && lastJournalId) {
      completedEntries.push(journalEntries[lastJournalId]);
      journalItemCount += journalEntries[lastJournalId].items.length;
    }
    // Calculate the next start row
    const nextStartRow = startRow + journalItemCount;

    return res.status(200).json({
      journalEntries: Object.values(completedEntries),
      hasMore: rawEntries.length > journalItemCount,
      nextStartRow: nextStartRow
    });

  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getJournalEntryById = async (req, res) => {
  try {
    const db = getDb();
    const entryId = req.params.id;

    if (!entryId) {
      return res.status(400).json({ error: 'Entry ID is required' });
    }

    let query = `
SELECT 
    "JournalEntry"."id" AS "journal_id", 
    "JournalEntry"."journal_date", 
    "JournalEntry"."financial_year", 
    "User"."username" AS "user_name", 
    "User"."id" AS "user_id", 
    "JournalItem"."account_id", 
    "Account"."name" AS "account_name", 
    "JournalItem"."group_id", 
    "Group"."name" AS "group_name", 
    "JournalItem"."amount", 
    "JournalItem"."type", 
    "JournalItem"."narration" AS "narration", 
    "JournalItem"."createdAt" AS "item_createdAt", 
    "JournalItem"."updatedAt" AS "item_updatedat"
FROM 
    "journal_entries" AS "JournalEntry"
LEFT JOIN 
    "journal_items" AS "JournalItem" ON "JournalEntry"."id" = "JournalItem"."journal_id"
LEFT JOIN 
    "account_list" AS "Account" ON "JournalItem"."account_id" = "Account"."id"
LEFT JOIN 
    "group_list" AS "Group" ON "JournalItem"."group_id" = "Group"."id"
LEFT JOIN 
    "users" AS "User" ON "JournalEntry"."user_id" = "User"."id"
WHERE 
    "JournalEntry"."id" = :entryId
    `;

    const replacements = { entryId };

    const rawEntries = await db.sequelize.query(query, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT
    });

    // Format the results
    const formattedEntries = rawEntries.reduce((acc, entry) => {
      const existingEntry = acc.find(e => e.id === entry.journal_id);
      const item = {
        journal_id: entry.journal_id,
        account_id: entry.account_id,
        group_id: entry.group_id,
        amount: entry.amount,
        type: entry.type,
        narration: entry.narration,
        account_name: entry.account_name,
        group_name: entry.group_name,
        debit_amount: entry.type ? 0 : entry.amount,
        credit_amount: entry.type ? entry.amount : 0,
      };

      if (existingEntry) {
        existingEntry.items.push(item);
      } else {
        acc.push({
          id: entry.journal_id,
          journal_date: entry.journal_date,
          user_id: entry.user_id,
          user_name: entry.user_name,
          financial_year: entry.financial_year,
          items: [item]
        });
      }

      return acc;
    }, []);

    if (formattedEntries.length > 0) {
      res.status(200).json(formattedEntries[0]);
    } else {
      res.status(404).json({ message: 'Journal entry not found' });
    }
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteJournalEntry = async (req, res) => {
  const entryId = req.params.id;

  try {
    const db = getDb();
    const transaction = await db.sequelize.transaction();
    const JournalEntry = db.journalEntry;
    const JournalItem = db.journalItem;
    const journal = await JournalEntry.findByPk(entryId, { transaction });

    if (!journal) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    // Delete associated journal items
    await JournalItem.destroy({
      where: { journal_id: entryId },
      transaction
    });

    // Delete journal entry
    await JournalEntry.destroy({
      where: { id: entryId },
      transaction
    });

    // Commit the transaction
    await transaction.commit();

    // Broadcast the deletion event
    broadcast({ type: 'DELETE', data: { id: journal.id, journal_date: journal.journal_date }, entryType: 'journal', user_id: journal.user_id, financial_year: journal.financial_year });

    res.status(204).send(); // Simplified response
  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    console.error('Error deleting journal entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


exports.updateJournalEntry = async (req, res) => {
  const entryId = req.params.id;
  const updatedEntry = req.body;

  // Convert journal_date string to Date object
  const journalDate = new Date(updatedEntry.journal_date);

  try {
    const db = getDb();
    const transaction = await db.sequelize.transaction();
    const JournalEntry = db.journalEntry;
    const JournalItem = db.journalItem;
    // Update journal entry
    const [affectedRows, updated] = await JournalEntry.update(
      {
        journal_date: journalDate,
        user_id: updatedEntry.user_id,
        updatedAt: new Date(),
        financial_year: updatedEntry.financial_year,
        type: 0
      },
      {
        where: { id: entryId },
        returning: true,
        plain: true,
        transaction
      }
    );

    if (affectedRows === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    // Delete existing journal items
    await JournalItem.destroy({
      where: { journal_id: entryId },
      transaction
    });

    // Insert updated journal items
    const journalItems = updatedEntry.items.map(item => ({
      journal_id: entryId,
      account_id: item.account_id,
      group_id: item.group_id,
      amount: parseFloat(item.amount).toFixed(2),
      narration: item.narration,
      type: item.type,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await JournalItem.bulkCreate(journalItems, {
      fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt', 'narration'],
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt', 'narration'],
      transaction
    });

    // Fetch the updated journal entry with items
    const updatedJournalEntry = await JournalEntry.findAll({
      attributes: [
        'id',
        'journal_date',
        'type'
      ],
      include: [
        {
          model: JournalItem,
          as: 'items',
          attributes: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'narration']
        }
      ],
      where: {
        id: entryId
      },
      transaction
    });
    
    const output = {
      id: updatedJournalEntry[0].id,
      journal_date: updatedJournalEntry[0].journal_date,
      type: updatedJournalEntry[0].type,
      items: updatedJournalEntry[0].items.map(item => ({
        journal_id: item.journal_id,
        account_id: item.account_id,
        group_id: item.group_id,
        amount: parseFloat(item.amount), // Convert amount to a float
        type: item.type,
        narration: item.narration,
      })),
    };
    // console.log(output);

    // Commit the transaction
    await transaction.commit();

    broadcast({ type: 'UPDATE', data: output, entryType: 'journal', user_id: updated.user_id, financial_year: updated.financial_year }); // Emit WebSocket message

    res.status(200).json({ message: 'Journal entry updated successfully' }); // Simplified response
  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    console.error('Error updating journal entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createJournalEntryWithItems = async (req, res) => {
  const newEntry = req.body;
  const db = getDb();
  const transaction = await db.sequelize.transaction();

  // Convert journal_date string to Date object
  const journalDate = new Date(newEntry.journal_date);

  try {
    const JournalEntry = db.journalEntry;
    const JournalItem = db.journalItem;

    // Create new journal entry
    const createdJournalEntry = await JournalEntry.create({
      journal_date: journalDate,
      user_id: newEntry.user_id,
      createdAt: new Date(),
      updatedAt: new Date(),
      financial_year: newEntry.financial_year,
      type: 0
    }, { transaction });

    // Insert journal items
    const journalItems = newEntry.items.map(item => ({
      journal_id: createdJournalEntry.id,
      account_id: item.account_id,
      group_id: item.group_id,
      amount: item.amount,
      narration: item.narration,
      type: item.type,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await JournalItem.bulkCreate(journalItems, {
      fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt', 'narration'],
      returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt', 'narration'],
      transaction
    });

    const entryId = createdJournalEntry.id;

    // Fetch the updated journal entry with items
    // Fetch the updated journal entry with items
    const updatedJournalEntry = await JournalEntry.findAll({
      attributes: [
        'id',
        'journal_date',
        'type'
      ],
      include: [
        {
          model: JournalItem,
          as: 'items',
          attributes: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'narration']
        }
      ],
      where: {
        id: entryId
      },
      transaction
    });

    const output = {
      id: updatedJournalEntry[0].id,
      journal_date: updatedJournalEntry[0].journal_date,
      type: updatedJournalEntry[0].type,
      items: updatedJournalEntry[0].items.map(item => ({
        journal_id: item.journal_id,
        account_id: item.account_id,
        group_id: item.group_id,
        amount: parseFloat(item.amount), // Convert amount to a float
        type: item.type,
        narration: item.narration,
      })),
    };  

    // Commit the transaction
    await transaction.commit();

    broadcast({ type: 'INSERT', data: output, entryType: 'journal', user_id: newEntry.user_id, financial_year: newEntry.financial_year }); // Emit WebSocket message
    res.status(201).json({ message: 'Journal entry created successfully' }); // Simplified response
  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    console.error('Error creating journal entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};