const moment = require('moment-timezone');

exports.categorizeCategoriesByGstRate = (categories) => {
  const gstCategoryMap = new Map();

  for (const category of categories) {
    const name = category.name.toLowerCase();

    if (name.includes("igst")) continue; // ✅ Skip categories containing "IGST"

    const gstRateMatch = name.match(/(\d+)%/);
    const gstRate = gstRateMatch ? parseInt(gstRateMatch[1], 10) : 0;

    gstCategoryMap.set(gstRate, category.id);
  }

  return gstCategoryMap;
};


exports.categorizeItemsByGstRate = (items) => {

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

exports.categorizeAccountsByGstRate = (accounts) => {
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

exports.extractAmountAndType = (input) => {
  // Regex to match the amount and the type (Dr or Cr) in braces
  const regex = /([\d.,]+)\s+\((Dr|Cr)\)/i;
  const match = input.match(regex);

  if (match) {
    const amount = parseFloat(match[1].replace(/,/g, '')); // Extract and parse the amount
    return amount;
  }

  return null; // Return nulls if no match is found
};

exports.createEntriesForInvoice = (
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
    // console.log(extractedData);
    // console.log(extractedData[valueKey]);
    const gstValue = extractedData[valueKey]; // Get the GST value for this rate
    // console.log(gstValue);
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
      const customerName = accountMap.has(accountNameKey) ? extractedData.Name : suspenseAccountName;
      if (!account) {
        console.error(`Missing account ID for Name: ${accountNameKey}. Defaulting to Suspense Account.`);
      }

      // Generate dynamic fields for this entry
      const dynamicFields = createDynamicFields(categoryId, dynamicFieldsMap, extractedData, gstValue);

      // Construct the entry
      const entry = {
        s_no:parseInt(extractedData.SNo,10),
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
        customerName: customerName,
        dynamicFields, // Populate dynamic fields here
      };

      entries.push(entry); // Add the entry to the entries array
    }
  });
  // console.log(entries);
  return entries;
};
const createDynamicFields = (categoryId, dynamicFieldsMap, extractedData, gstValue) => {
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
