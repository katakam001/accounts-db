const { PdfReader } = require("pdfreader");
const { getDb } = require("../utils/getDb");
const moment = require('moment-timezone');

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Extract additional parameters from the request body
    const { statementType, bankName, accountId, userId, financialYear } = req.body;
    const suspenseAccountName = "Suspense Account";

    // Log the parameters for debugging
    console.log("Statement Type:", statementType);
    console.log("Bank Name:", bankName);
    console.log("accountId:", accountId);
    console.log("user Id:", userId);
    console.log("financial year:", financialYear);

    const tableDataByPage = await extractTableFromBuffer(req.file.buffer);

    const groupedRecords = groupRecordsByTransactionId(tableDataByPage);

    const { accountMap, bankAccount } = await loadAccountsWithGroupIds(parseInt(userId), financialYear, parseInt(accountId));
    console.log(Object.keys(groupedRecords).length);

    // Calculate the total count
    const totalCount = Object.values(groupedRecords).reduce((sum, arr) => sum + arr.length, 0);

    console.log(totalCount); // Output: 5


    // Process the transactions
    await processTransactions(groupedRecords, accountMap, suspenseAccountName.toLowerCase(), bankAccount, userId, financialYear);

    res.status(200).json({
      message: "File processed and transactions completed successfully."
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Main function to extract data from the PDF buffer
const extractTableFromBuffer = buffer => {
  return new Promise((resolve, reject) => {
    const tableDataByPage = {};
    let currentPage = 0;
    let headersFound = false; // Track if all headers are found
    let headerY = null; // Y-coordinate of the header row
    let tableEndY = null;
    let isAfterTable = false; // Flag to ignore rows after "Details of statement"
    const epsilon = 0.1; // Tolerance for y-position comparison
    const requiredHeaders = ["S.No", "Date", "Transaction Id", "Remarks", "Amount(Rs.)", "Balance(Rs.)"];
    let detectedHeaders = new Set(); // Store detected headers for validation

    new PdfReader().parseBuffer(buffer, (err, item) => {
      if (err) {
        reject(err);
      } else if (!item) {
        // End of buffer - process and resolve table data
        const combinedTableData = {};
        Object.keys(tableDataByPage).forEach(page => {
          // Combine multi-line rows for each page
          const combinedRows = combineMultiLineRows(tableDataByPage[page]);
          // console.log(combinedRows);

          // Convert to JSON
          const tableJSON = convertToJSONSimple(requiredHeaders, combinedRows);
          // console.log(`Page ${page} Table Data:`, tableJSON);
          combinedTableData[page] = tableJSON;
        });

        resolve(combinedTableData);
      } else if (item.page) {
        // New page detected
        currentPage = item.page;
        tableDataByPage[currentPage] = [];
        headersFound = false; // Reset header detection for the new page
        headerY = null;
        tableEndY = null;
        isAfterTable = false; // Reset the flag for the new page
        detectedHeaders.clear(); // Clear detected headers
      } else if (item.text) {
        const decodedText = decodeURIComponent(item.text);

        // Detect headers
        if (requiredHeaders.includes(decodedText)) {
          if (headerY === null) {
            headerY = item.y; // Set the first header's y-coordinate
          }

          // Add header if it's within the y tolerance
          if (Math.abs(item.y - headerY) <= epsilon) {
            detectedHeaders.add(decodedText);
          }

          // Check if all required headers are detected
          if (detectedHeaders.size === requiredHeaders.length) {
            headersFound = true;
            isAfterTable = false; // Reset the flag when headers are found
            console.log(`Headers detected on Page ${currentPage} at Y: ${headerY}`);
          }
        }

        // Identify the end of the table when "Details of statement" is detected
        if (decodedText === "Details of statement" && tableEndY === null) {
          tableEndY = item.y;
          isAfterTable = true; // Set the flag to ignore content after this point
          console.log(`Page ${currentPage}: Table End Y = ${tableEndY}`);
        }

        // Skip rows if we are after the table
        if (isAfterTable) {
          // console.log(`Ignoring text after table: "${decodedText}"`);
          return; // Skip this row
        }

        // Add rows that are valid table rows
        if (
          headersFound &&
          item.y > headerY // Rows must be below headers
        ) {
          tableDataByPage[currentPage].push({
            text: decodedText,
            x: item.x,
            y: item.y,
          });
        }
      }
    });
  });
};

// Group records by Transaction Id
const groupRecordsByTransactionId = (tableDataByPage) => {
  const groupedRecords = {};

  // Flatten page-wise data and group by Transaction Id
  Object.values(tableDataByPage).flat().forEach((row) => {
    const transactionId = row["Transaction Id"];
    if (!groupedRecords[transactionId]) {
      groupedRecords[transactionId] = [];
    }
    groupedRecords[transactionId].push(row);
  });

  return groupedRecords;
};

const loadAccountsWithGroupIds = async (userId, financialYear, accountId) => {
  const accountMap = new Map();
  let bankAccount = null; // To store the bankAccount object if accountId matches

  try {
    const db = getDb(); // Get database instance

    // Native SQL query
    const sqlQuery = `
      SELECT 
        al.id AS account_id, 
        LOWER(al."name") AS account_name, 
        ag.group_id
      FROM account_list al
      JOIN account_group ag ON al.id = ag.account_id
      WHERE al.user_id = :userId AND al.financial_year = :financialYear;
    `;

    // Execute the query
    const results = await db.sequelize.query(sqlQuery, {
      replacements: { userId, financialYear }, // Replace parameters with actual values
      type: db.Sequelize.QueryTypes.SELECT, // Ensure results are returned as plain objects
    });

    // Process results and populate the Map
    results.forEach((row) => {
      const accountName = row.account_name;
      const rowAccountId = row.account_id;
      const groupId = row.group_id;
      // console.log(accountName);

      // Check if this row matches the provided accountId
      if (rowAccountId === accountId) {
        bankAccount = {
          accountId: rowAccountId,
          accountName,
          groupId,
        };
      }

      // Store the account data in the map
      accountMap.set(accountName, {
        accountId: rowAccountId,
        groupId,
      });
    });

    console.log("Accounts with group IDs loaded:");
    if (bankAccount) {
      console.log("Bank Account object for the specified accountId:", bankAccount);
    } else {
      console.warn("No matching account found for the provided accountId:", accountId);
    }
  } catch (error) {
    console.error("Error loading accounts with group IDs:", error);
  }

  return { accountMap, bankAccount }; // Return both the map and the bankAccount object
};

const processTransactions = async (groupedRecords, accountMap, suspenseAccountName, bankAccount, userId, financialYear) => {
  const db = getDb(); // Get database instance
  const t = await db.sequelize.transaction(); // Start a transaction
  const checkAmountType = (input) => input.includes('(Cr)') ? true : input.includes('(Dr)') ? false : null;

  try {
    const JournalEntry = db.journalEntry;
    const JournalItem = db.journalItem;
    const CashEntryBatch = db.cashEntriesBatch; // Reference to cash_entries_batch
    const Balance = db.balance; // Reference to the `balance` table
    const BatchOperations = db.globalBatchOperations; // Reference to the batch tracking table

    // Step 1: Mark batch operation as active
    await BatchOperations.upsert({
      user_id: userId,
      financial_year: financialYear,
      is_batch: true,
    }, { transaction: t });

    for (const [transactionId, records] of Object.entries(groupedRecords)) {
      const journalDate = moment(records[0].Date, 'DD/MM/YYYY').tz('Asia/Kolkata')
        .set({ hour: 5, minute: 30, second: 0 });
      let totalAmount = 0;
      let type;
      let createCashEntry = false;
      const cashEntries = []; // List of cash entries for batch processing
      const journalItems = []; // List of journal items for batch processing

      for (const record of records) {
        const remarks = record.Remarks.toLowerCase();
        const amount = extractAmountAndType(record["Amount(Rs.)"]);

        if (remarks.includes("by cash") || remarks.includes("cardless deposit")) {
          createCashEntry = true;

          // Prepare a cash entry for batch table
          cashEntries.push({
            cash_date: journalDate,
            narration: record.Remarks,
            account_id: bankAccount.accountId,
            group_id: bankAccount.groupId,
            type: !checkAmountType(record["Amount(Rs.)"]),
            amount,
            user_id: userId,
            financial_year: financialYear,
            transaction_id: transactionId,
          });

          totalAmount += amount; // Keep track of the total
        } else {
          let matchedAccount = null;
          if (remarks.includes("charges")) {
            matchedAccount = "bank charges";
          } else {
            for (const accountName of accountMap.keys()) {
              if (remarks.includes(accountName.toLowerCase())) {
                matchedAccount = accountName;
                break;
              }
            }
            type = !checkAmountType(record["Amount(Rs.)"]);
          }
          const accountDetails = matchedAccount
            ? accountMap.get(matchedAccount)
            : accountMap.get(suspenseAccountName);

          totalAmount += amount;

          journalItems.push({
            journal_id: null,
            account_id: accountDetails.accountId,
            narration: record.Remarks,
            group_id: accountDetails.groupId,
            amount,
            type: checkAmountType(record["Amount(Rs.)"]),
          });
        }
      }

      if (createCashEntry) {
        // Insert cash entries into cash_entries_batch
        await CashEntryBatch.bulkCreate(cashEntries, { transaction: t });
        console.log(`Batch cash entries created for transactionId: ${transactionId}`);
      } else {
        const journalEntry = await JournalEntry.create({
          journal_date: journalDate,
          transaction_id: transactionId,
          user_id: userId,
          financial_year: financialYear,
          type: 1,
        }, { transaction: t });

        journalItems.forEach((item) => {
          item.journal_id = journalEntry.id;
        });

        const cashAccount = accountMap.get(bankAccount.accountName);
        if (cashAccount) {
          journalItems.push({
            journal_id: journalEntry.id,
            account_id: cashAccount.accountId,
            narration: records[0].Remarks,
            group_id: cashAccount.groupId,
            amount: totalAmount,
            type: type,
          });
        }

        await JournalItem.bulkCreate(journalItems, {
          fields: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt', 'narration'],
          returning: ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt', 'narration'],
          transaction: t,
        });

        console.log(`Journal entry and items created for transactionId: ${transactionId}`);
      }
    }

    // Step 2: Calculate net change for both real-time and batch entries
    const [netChangeResult] = await db.sequelize.query(
      `SELECT SUM(CASE WHEN type THEN amount ELSE -amount END) AS net_change
   FROM combined_cash_entries
   WHERE user_id = :user_id AND financial_year = :financial_year`,
      {
        replacements: { user_id: userId, financial_year: financialYear },
        type: db.sequelize.QueryTypes.SELECT,
        transaction: t,
      }
    );
    const netChange = netChangeResult.net_change || 0;

    // Step 3: Directly update the balance table with the net change
    await Balance.update(
      { amount: netChange }, // Directly set the balance amount to the calculated net change
      { where: { user_id: userId, financial_year: financialYear }, transaction: t }
    );


    // Step 5: Mark batch operation as complete
    await BatchOperations.update(
      { is_batch: false },
      { where: { user_id: userId, financial_year: financialYear }, transaction: t }
    );

    console.log("Batch operation completed successfully.");
    await t.commit();
    console.log("All transactions processed successfully.");
  } catch (error) {
    await t.rollback();
    console.error("Error processing transactions:", error);
  }
};


// Function to combine multi-line rows
const combineMultiLineRows = rows => {
  const combinedRows = [];
  let tempRow = null; // Temporarily hold a row to combine text

  rows.forEach(row => {
    if (tempRow && Math.abs(tempRow.x - row.x) < 0.1) {
      // Combine text if x-coordinates are the same (or very close)
      tempRow.text += ` ${row.text}`;
      tempRow.y = Math.max(tempRow.y, row.y); // Keep the larger y-value
    } else {
      // Push the previous row to the result if it exists
      if (tempRow) {
        combinedRows.push(tempRow);
      }
      // Start a new temp row
      tempRow = { ...row };
    }
  });

  // Push the last remaining row
  if (tempRow) {
    combinedRows.push(tempRow);
  }

  return combinedRows;
};

// Function to convert rows to JSON using headers
const convertToJSONSimple = (headers, parsedRows) => {
  const result = [];
  let row = {}; // Temporary row object
  let columnIndex = 0; // Track the current column index

  parsedRows.forEach((item, index) => {
    // Map the current text to the appropriate column header
    row[headers[columnIndex]] = item.text;

    // Move to the next column
    columnIndex++;

    // If we’ve filled all columns, add the row to the result and reset
    if (columnIndex === headers.length) {
      result.push(row);
      row = {}; // Start a new row
      columnIndex = 0; // Reset column index
    }
  });

  return result;
};

const extractAmountAndType = (input) => {
  // Regex to match the amount and the type (Dr or Cr) in braces
  const regex = /([\d.,]+)\s+\((Dr|Cr)\)/i;
  const match = input.match(regex);

  if (match) {
    const amount = parseFloat(match[1].replace(/,/g, '')); // Extract and parse the amount
    return amount;
  }

  return null; // Return nulls if no match is found
};



