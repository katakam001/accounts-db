const { PdfReader } = require("pdfreader");
const { getDb } = require("../utils/getDb");
const moment = require('moment-timezone');
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const pLimit = require("p-limit");
const ExcelJS = require("exceljs");
const { fetchCategories } = require('../services/category.service');
const { getAllItems } = require('../services/items.service');
const entryService = require('../services/entry.service');
const limit = pLimit(1); // Set concurrency to 1

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

    console.log("File uploaded successfully:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Compress the uploaded PDF
    console.log("Starting PDF compression...");
    const compressedBuffer = await compressPDF(req.file.buffer);
    console.log("PDF compression completed. Compressed file size:", compressedBuffer.length);

    const tableDataByPage = await extractTableFromBuffer(compressedBuffer);

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

exports.entriesupload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Extract additional parameters from the request body
    const {  userId, financialYear } = req.body;
    const suspenseAccountName = "Suspense Account";

    // Log the parameters for debugging
    console.log("user Id:", userId);
    console.log("financial year:", financialYear);
    const type=2;

    console.log("File uploaded successfully:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
    console.log("Memory usage before file processing:", process.memoryUsage());

    const { accountMap, bankAccount } = await loadAccountsWithGroupIds(parseInt(userId), financialYear, null);


    const saleAccounts = await getAccountsByGroup('Sale Account', userId, financialYear);
    const categoryAccountMap = categorizeAccountsByGstRate(saleAccounts);
    const categories = await fetchCategories({ type,userId, financialYear });
    const categoryMap = categorizeCategoriesByGstRate(categories);
    const items = await getAllItems({ userId, financialYear });
    const itemsMap = categorizeItemsByGstRate(items);
    const categoryIds = Array.from(categoryMap.values()); // Extract category_id values from categoryMap
    const unitIdMap = await fetchUnitIdsByCategoryIds(categoryIds); // Get unit_id map from the function
    const dynamicFieldsMap  =await fetchDynamicFieldsByCategoryIds(categoryIds); 

    // Process the file
    await processExcelWithExcelJS(req.file.buffer, categoryAccountMap, accountMap,categoryMap,itemsMap,unitIdMap,dynamicFieldsMap,suspenseAccountName.toLowerCase(),parseInt(userId),financialYear,type);

    console.log("Memory usage after file processing:", process.memoryUsage());


    res.status(200).json({
      message: "File processed and transactions completed successfully."
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.validateEntriesupload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Extract additional parameters from the request body
    const { userId, financialYear } = req.body;

    // Log the parameters for debugging
    console.log("user Id:", userId);
    console.log("financial year:", financialYear);

    console.log("File uploaded successfully:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
    console.log("Memory usage before file processing:", process.memoryUsage());

    const { accountMap } = await loadAccountsWithGroupIds(parseInt(userId), financialYear, null);

    // Process the file
    const accountNotExistMap = new Map();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    workbook.eachSheet((sheet) => {
      console.log(`Processing sheet: ${sheet.name}`);

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip the header row

        // Extract required fields
        const extractedData = {
          Name: row.getCell(5).value,
        };

        // Validation Checks
        if (!accountMap.has(extractedData.Name.toLowerCase())) {
          // Update map for missing accounts
          if (accountNotExistMap.has(extractedData.Name.toLowerCase())) {
            accountNotExistMap.set(
              extractedData.Name.toLowerCase(),
              accountNotExistMap.get(extractedData.Name.toLowerCase()) + 1
            );
          } else {
            accountNotExistMap.set(extractedData.Name.toLowerCase(), 1);
          }
        }
      });
    });

    const exportsDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Create a new Excel workbook for missing accounts
    const outputWorkbook = new ExcelJS.Workbook();
    const outputWorksheet = outputWorkbook.addWorksheet('Missing Accounts');

    // Add header row
    outputWorksheet.addRow(['Account', 'Entries']);

    // Add data rows using the corrected Map iteration
    accountNotExistMap.forEach((value, key) => {
      outputWorksheet.addRow([key, value]); // Write missing account and entries count
    });

    // Write the workbook to a file
    const filePath = path.join(exportsDir, `missing_accounts_${userId}_${financialYear}.xlsx`);
    await outputWorkbook.xlsx.writeFile(filePath);
    console.log("Memory usage after file processing:", process.memoryUsage());

    res.download(filePath);

  } catch (error) {
    console.error("Error processing Excel:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


const processExcelWithExcelJS = async (buffer, categoryAccountMap, accountMap, categoryMap, itemsMap, unitIdMap, dynamicFieldsMap, suspenseAccountName,userId,financialYear,type) => {
  try {
    // console.log(categoryMap);
    // console.log(accountMap);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const entries = []; // Initialize an array to collect all entries across all rows

    workbook.eachSheet((sheet) => {
      console.log(`Processing sheet: ${sheet.name}`);

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip the header row

        // Extract required fields
        const extractedData = {
          Type: row.getCell(1).value,
          FeedNo: row.getCell(2).value,
          FeedDate: row.getCell(3).value,
          Name: row.getCell(5).value,
          GstInNo: row.getCell(6).value,
          GstValue0: row.getCell(7).value,
          GstValue5: row.getCell(8).value,
          Gst5: row.getCell(9).value,
          GstValue12: row.getCell(10).value,
          Gst12: row.getCell(11).value,
          GstValue18: row.getCell(12).value,
          Gst18: row.getCell(13).value,
          GstValue28: row.getCell(14).value,
          Gst28: row.getCell(15).value,
          CGst: row.getCell(17).value,
          SGst: row.getCell(18).value,
          TotGst: row.getCell(19).value,
          NetAmt: row.getCell(22).value,
        };

        // Validation Checks
        let isValid = true;

        const taxTolerance = 0.02;

        const roundedgst5 = parseFloat(extractedData.Gst5.toFixed(2));
        const calculatedGst5 = parseFloat((extractedData.GstValue5 * 0.05).toFixed(2));
        // console.log(`Row ${rowNumber} - Gst18: ${gst18}, Calculated Gst18: ${calculatedGst18}`);
        const gst5Difference = Math.abs(roundedgst5 - calculatedGst5).toFixed(2);
        if (parseFloat(gst5Difference) > taxTolerance) {
          console.log(`Difference: ${gst5Difference}`);
          console.log(parseFloat(gst5Difference));
          console.log(parseFloat(gst5Difference) >= taxTolerance);
          console.error(`Mismatch in Gst18 at row ${rowNumber}: Gst18 (${roundedgst5}) does not match calculated value (${calculatedGst5}).`);
          isValid = false;
        }

        const roundedGst12 = parseFloat(extractedData.Gst12.toFixed(2));
        const roundedCalculatedGst12 = parseFloat((extractedData.GstValue12 * 0.12).toFixed(2));
        // console.log(`Row ${rowNumber} - Gst18: ${gst18}, Calculated Gst18: ${calculatedGst18}`);
        const gst12Difference = Math.abs(roundedGst12 - roundedCalculatedGst12).toFixed(2);
        if (parseFloat(gst12Difference) > taxTolerance) {
          console.log(`Difference: ${gst12Difference}`);
          console.log(parseFloat(gst12Difference));
          console.log(parseFloat(gst12Difference) >= taxTolerance);
          console.error(`Mismatch in Gst18 at row ${rowNumber}: Gst18 (${roundedGst12}) does not match calculated value (${roundedCalculatedGst12}).`);
          isValid = false;
        }

        // Check Gst18
        const gst18 = parseFloat(extractedData.Gst18.toFixed(2));
        const calculatedGst18 = parseFloat((extractedData.GstValue18 * 0.18).toFixed(2));
        // console.log(`Row ${rowNumber} - Gst18: ${gst18}, Calculated Gst18: ${calculatedGst18}`);
        const difference = Math.abs(gst18 - calculatedGst18).toFixed(2);
        if (parseFloat(difference) > taxTolerance) {
          console.log(`Difference: ${difference}`);
          console.log(parseFloat(difference));
          console.log(parseFloat(difference) >= taxTolerance);
          console.error(`Mismatch in Gst18 at row ${rowNumber}: Gst18 (${gst18}) does not match calculated value (${calculatedGst18}).`);
          isValid = false;
        }

        // Check Gst28
        const gst28 = parseFloat(extractedData.Gst28.toFixed(2));
        const calculatedGst28 = parseFloat((extractedData.GstValue28 * 0.28).toFixed(2));
        // console.log(`Row ${rowNumber} - Gst28: ${gst28}, Calculated Gst28: ${calculatedGst28}`);
        if (Math.abs(gst28 - calculatedGst28) >= taxTolerance) {
          console.error(`Mismatch in Gst28 at row ${rowNumber}: Gst28 (${gst28}) does not match calculated value (${calculatedGst28}).`);
          isValid = false;
        }

        const calculatedGstSum = parseFloat((
          (extractedData.GstValue5 * 0.05) +
          (extractedData.GstValue12 * 0.12) +
          (extractedData.GstValue18 * 0.18) +
          (extractedData.GstValue28 * 0.28)
        ).toFixed(2)); // Ensure this is a number

        const cGst = parseFloat(extractedData.CGst); // Ensure CGst is a number
        const sGst = parseFloat(extractedData.SGst); // Ensure SGst is a number
        const totGst = parseFloat(extractedData.TotGst); // Reuse TotGst as a number

        const calculatedCgstSgstSum = parseFloat((cGst + sGst).toFixed(2)); // Sum and round to 2 decimal places

        const tolerance = 0.05;

        // For TotGst validation
        if (Math.abs(calculatedGstSum - totGst) > tolerance) {
          console.error(`Mismatch in CGst + SGst at row ${rowNumber}: Calculated (${calculatedCgstSgstSum}) does not match TotGst (${totGst}).`);
          console.error(`Mismatch in TotGst at row ${rowNumber}: Difference exceeds tolerance.`);
          isValid = false;
        }

        // For CGst + SGst validation
        if (Math.abs(calculatedCgstSgstSum - totGst) > tolerance) {
          console.error(`Mismatch in CGst + SGst at row ${rowNumber}: Difference exceeds tolerance.`);
          isValid = false;
        }

        // If validation fails, skip processing this row
        if (!isValid) {
          console.warn(`Skipping row ${rowNumber} due to validation errors.`);
          return;
        }

        // Remove unnecessary fields after validation
        delete extractedData.Gst5;
        delete extractedData.Gst12;
        delete extractedData.Gst18;
        delete extractedData.Gst28;
        delete extractedData.CGst;
        delete extractedData.SGst;
        delete extractedData.TotGst;

        // console.log(`Processed row ${rowNumber}:`, extractedData);
        const rowEntries = createEntriesForInvoice(
          extractedData,
          categoryMap,
          itemsMap,
          categoryAccountMap,
          unitIdMap,
          accountMap,
          suspenseAccountName,
          dynamicFieldsMap,
          userId, // userId
          financialYear, // financialYear
          type // type
        );

        entries.push(...rowEntries);

        // Add your logic here to save extractedData to the database
      });
    });
    if (entries.length === 0) {
      console.warn('No valid entries were processed.');
      return;
    }
    // Group entries by invoiceNumber
    const groupedEntries = entries.reduce((map, entry) => {
      if (!map.has(entry.invoiceNumber)) {
        map.set(entry.invoiceNumber, []);
      }
      map.get(entry.invoiceNumber).push(entry);
      return map;
    }, new Map());

    // Process each group of entries by invoiceNumber
    for (const [invoiceNumber, invoiceEntries] of groupedEntries) {
      console.log(`Processing invoice ${invoiceNumber} with ${invoiceEntries} entries.`);
      const items = await entryService.addEntriesService(invoiceEntries); // Process each group
      console.log(`Invoice ${invoiceNumber} processed successfully:`, items);
    }

  } catch (error) {
    console.error("Error processing Excel file:", error);
  }
};
const createEntriesForInvoice = (
  extractedData, 
  gstCategoryMap, 
  gstItemMap, 
  categoryAccountMap, 
  unitIdMap, 
  accountMap, 
  suspenseAccountName, 
  dynamicFieldsMap, // Pass dynamic fields map
  userId, 
  financialYear, 
  type
) => {
  const entries = []; // Initialize an array to store all entries for this invoice

  // Define GST fields and rates
  const gstFields = [
    { rate: 0, valueKey: 'GstValue0' },
    { rate: 5, valueKey: 'GstValue5' },
    { rate: 12, valueKey: 'GstValue12' },
    { rate: 18, valueKey: 'GstValue18' },
    { rate: 28, valueKey: 'GstValue28' },
  ];

  gstFields.forEach(({ rate, valueKey }) => {
    const gstValue = extractedData[valueKey]; // Get the GST value for this rate
    if (gstValue > 0) {
      // Retrieve mappings for this GST rate
      const categoryId = gstCategoryMap.get(rate);
      const itemId = gstItemMap.get(rate);
      const categoryAccountId = categoryAccountMap.get(rate);
      const unitId = unitIdMap.get(categoryId);

      if (!categoryId || !itemId || !categoryAccountId || !unitId) {
        console.error(`Missing mapping for GST rate ${rate}`);
        return;
      }

      // Retrieve account_id using extractedData.Name (lowercase) or use Suspense Account
      const accountNameKey = extractedData.Name.toLowerCase();
      const account = accountMap.get(accountNameKey) || accountMap.get(suspenseAccountName.toLowerCase());
      const customerName =accountMap.has(accountNameKey) ? extractedData.Name : suspenseAccountName;
      if (!account) {
        console.error(`Missing account ID for Name: ${accountNameKey}. Defaulting to Suspense Account.`);
      }

      // Generate dynamic fields for this entry
      const dynamicFields = createDynamicFields(categoryId, dynamicFieldsMap, extractedData,gstValue);

      // Construct the entry
      const entry = {
        category_id: categoryId,
        item_id: itemId,
        quantity: 1, // Assuming quantity is 1 for simplicity
        unit_id: unitId,
        unit_price: gstValue, // Assuming unit price equals GST value for simplicity
        value: gstValue,
        total_amount: parseFloat((gstValue + (gstValue * rate / 100)).toFixed(2)), // Adding GST percentage to the total
        category_account_id: categoryAccountId,
        entry_date: moment(extractedData.FeedDate, 'DD/MM/YYYY').tz('Asia/Kolkata').set({ hour: 5, minute: 30, second: 0 }).format('YYYY-MM-DD HH:mm:ss.SSS Z'),
        user_id: userId,
        type, // Hardcoded type
        financial_year: financialYear,
        invoiceNumber: extractedData.FeedNo, // Invoice number from extractedData
        account_id: account.accountId, // Use accountMap or default to Suspense Account
        customerName:customerName,
        dynamicFields, // Populate dynamic fields here
      };

      entries.push(entry); // Add the entry to the entries array
    }
  });
  // console.log(entries);
  return entries;
};
const createDynamicFields = (categoryId, dynamicFieldsMap, extractedData,gstValue) => {
  const dynamicFields = []; // Initialize the dynamic fields array

  const fields = dynamicFieldsMap.get(categoryId) || []; // Retrieve fields for the category_id
  fields.forEach((field) => {
    const { field_id, field_name, field_type, field_category, exclude_from_total, tax_account_id } = field;

    // Handle number fields (for tax calculation)
    if (field_type === 'number') {
      if (field_category === 1 && !exclude_from_total) {
        // Tax calculation logic: extract percentage from field_name
        const taxPercentageMatch = field_name.match(/(\d+(\.\d+)?)%/); // Match percentage like "2.5%"
        const taxPercentage = taxPercentageMatch ? parseFloat(taxPercentageMatch[1]) : 0; // Extract percentage or default to 0
        const field_value = (gstValue * taxPercentage / 100).toFixed(2); // Calculate tax value based on NetAmt

        dynamicFields.push({
          field_id,
          field_name,
          field_value, // Computed tax value
          field_category,
          exclude_from_total,
          tax_account_id,
        });
      }
    }

    // Handle text fields (only for "invoice no.")
    if (field_name.toLowerCase() === 'invoice no.') {
      dynamicFields.push({
        field_id,
        field_name,
        field_value: extractedData.FeedNo || '', // Update with extractedData.invoiceNumber
        field_category,
        exclude_from_total,
        tax_account_id,
      });
    }
  });
  // console.log(dynamicFields);

  return dynamicFields;
};

const getAccountsByGroup = async (group_name, user_id, financial_year) => {
  try {
    const db = getDb(); // Get Sequelize DB instance

    const results = await db.sequelize.query(
      `SELECT 
        al.id AS account_id, 
        al.name AS account_name, 
        g.id AS group_id
      FROM 
        account_list AS al
      INNER JOIN 
        account_group AS ag 
      ON 
        al.id = ag.account_id
      INNER JOIN 
        group_list AS g 
      ON 
        ag.group_id = g.id
      WHERE 
        g.name = :group_name
        AND al.user_id = :user_id
        AND al.financial_year = :financial_year;`,
      {
        replacements: { group_name, user_id, financial_year }, // Replace dynamic parameters
        type: db.sequelize.QueryTypes.SELECT, // Query type
      }
    );

    // console.log(results);
    // Return the raw results without additional processing
    return results;
  } catch (error) {
    console.error('Error fetching accounts:', error);
    throw new Error('Could not retrieve accounts for the group');
  }
};
const fetchUnitIdsByCategoryIds = async (categoryIds) => {
  try {
    const db = getDb(); // Get the database instance
    const query = `
      SELECT category_id, unit_id 
      FROM category_units 
      WHERE category_id IN (:categoryIds)
    `;
    
    const results = await db.sequelize.query(query, {
      replacements: { categoryIds }, // Pass the category IDs
      type: db.sequelize.QueryTypes.SELECT, // Query type
    });

    // Transform results into a Map for easier access
    const unitIdMap = new Map();
    results.forEach((row) => {
      unitIdMap.set(row.category_id, row.unit_id);
    });

    return unitIdMap; // Map of category_id => unit_id
  } catch (error) {
    console.error('Error fetching unit IDs:', error.message);
    throw new Error('Failed to fetch unit IDs');
  }
};

const fetchDynamicFieldsByCategoryIds = async (categoryIds) => {
  try {
    const db = getDb(); // Initialize database instance

    const query = `
      SELECT 
          fm.category_id,
          fm.field_id,
          f.field_name,
          fm.field_type,
          fm.required,
          fm.field_category,
          fm.exclude_from_total,
          fm.account_id AS tax_account_id
      FROM 
          fields_mapping fm
      JOIN 
          fields f
      ON 
          fm.field_id = f.id
      WHERE 
          fm.category_id IN (:categoryIds);
    `;

    const results = await db.sequelize.query(query, {
      replacements: { categoryIds }, // Pass the category IDs dynamically
      type: db.sequelize.QueryTypes.SELECT, // Query type for plain results
    });

    // Group results by category_id for easier access
    const dynamicFieldsMap = new Map();
    results.forEach((field) => {
      if (!dynamicFieldsMap.has(field.category_id)) {
        dynamicFieldsMap.set(field.category_id, []);
      }
      dynamicFieldsMap.get(field.category_id).push({
        field_id: field.field_id,
        field_name: field.field_name,
        field_type: field.field_type,
        required: field.required,
        field_category: field.field_category,
        exclude_from_total: field.exclude_from_total,
        tax_account_id: field.tax_account_id,
      });
    });

    return dynamicFieldsMap; // Map of category_id -> dynamic fields array
  } catch (error) {
    console.error('Error fetching dynamic fields:', error.message);
    throw new Error('Failed to fetch dynamic fields');
  }
};


const categorizeAccountsByGstRate = (accounts) => {
  const categoryAccountMap = new Map();

  accounts.forEach((account) => {
    // Extract GST rate from account name (e.g., "5%", "12%", etc.)
    const gstRateMatch = account.account_name.match(/(\d+)%/);
    const gstRate = gstRateMatch ? parseInt(gstRateMatch[1], 10) : 0; // Default to 0% if no match

    // Set the gstRate as key and category_id as value
    categoryAccountMap.set(gstRate, account.account_id);
  });

  return categoryAccountMap; // Return the Map
};

const categorizeCategoriesByGstRate = (categories) => {

  const gstCategoryMap = new Map(); // To store GST percentages and their category IDs

  categories.forEach((category) => {
    const name = category.name.toLowerCase(); // Convert to lowercase for consistency
    const gstRateMatch = name.match(/(\d+)%/); // Check if the name contains a percentage like "5%"
    const gstRate = gstRateMatch ? parseInt(gstRateMatch[1], 10) : 0; // Default to 0% if no percentage is found
  
    gstCategoryMap.set(gstRate, category.id); // Map the GST rate to its category_id
  });
  
  // Example logging

  return gstCategoryMap; // Return the Map
};

const categorizeItemsByGstRate = (items) => {

  const gstItemMap = new Map();

  items.forEach((item) => {
    const name = item.name.toLowerCase(); // Convert to lowercase for consistency
    const gstRateMatch = name.match(/(\d+)%/); // Check for percentage like "5%" or "12%"
    const gstRate = gstRateMatch ? parseInt(gstRateMatch[1], 10) : 0; // Default to 0% for no match
  
    gstItemMap.set(gstRate, item.id); // Map GST rate to category_id (id)
  });
  
  // Example logging

  return gstItemMap; // Return the Map
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
          type: 0,
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



// Ghostscript compression function
async function compressPDF(inputBuffer) {
  return limit(() =>
    new Promise((resolve, reject) => {
      // Generate unique file names
      const uniqueId = uuidv4();
      const inputFilePath = path.join(__dirname, `temp-input-${uniqueId}.pdf`);
      const outputFilePath = path.join(__dirname, `temp-output-${uniqueId}.pdf`);

      try {
        // Save input buffer as a temporary file
        fs.writeFileSync(inputFilePath, inputBuffer);

        // Ghostscript compression command
        const command =
          process.platform === "win32"
            ? `gswin64c -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dBATCH -sOutputFile=${outputFilePath} ${inputFilePath}`
            : `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dBATCH -sOutputFile=${outputFilePath} ${inputFilePath}`;

        // Execute the command
        exec(command, (error) => {
          if (error) {
            console.error("Ghostscript error:", error.message);
            reject(error);
          } else {
            // Read the compressed file
            const compressedBuffer = fs.readFileSync(outputFilePath);

            // Cleanup temporary files
            fs.unlinkSync(inputFilePath); // Ensure temp input file is deleted
            fs.unlinkSync(outputFilePath);

            resolve(compressedBuffer);
          }
        });
      } catch (cleanupError) {
        // In case of failure, ensure temp files are cleaned
        if (fs.existsSync(inputFilePath)) fs.unlinkSync(inputFilePath);
        if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);

        reject(cleanupError);
      }
    })
  );
}


