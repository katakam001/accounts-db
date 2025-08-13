const moment = require('moment-timezone');

exports.categorizeCategoriesByGstRate = (categories) => {
  const gstCategoryMap = new Map();

  for (const category of categories) {
    const name = category.name.toUpperCase();

    // 🔍 Determine tax type
    const taxType = name.includes("IGST") ? "igst" : "cgst";

    // 🔍 Extract GST Rate
    const gstRateMatch = name.match(/(\d+)%/);
    const gstRate = gstRateMatch ? parseInt(gstRateMatch[1], 10) : 0;

    // 🔍 Extract item name
    // Step 1: Remove 'PURCHASE' or 'SALE' from the start
    const tokens = name.split(" ");
    tokens.shift(); // removes 'PURCHASE' or 'SALE'

    // Step 2: Find index of token that contains '%' (e.g., '5%')
    const rateIndex = tokens.findIndex(token => token.includes('%'));

    // Step 3: Extract item name tokens (before rate)
    const itemTokens = tokens.slice(0, rateIndex);
    const itemName = itemTokens.join(" ").trim();

    // 🧩 Composite key: ITEM_NAME|RATE|TAX_TYPE
    const compositeKey = `${itemName}|${gstRate}|${taxType}`;

    gstCategoryMap.set(compositeKey, category.id);
  }

  return gstCategoryMap;
};

exports.categorizeItemsByGstRate = (items) => {
  const gstItemMap = new Map(); // Map<string, item_id>

  items.forEach((item) => {
    const name = item.name.toUpperCase().trim(); // Consistent casing
    const gstRateMatch = name.match(/(\d+)%/);    // Extract GST rate
    const gstRate = gstRateMatch ? parseInt(gstRateMatch[1], 10) : 0;

    // 🔍 Extract item name: all words before the GST rate token
    const tokens = name.split(" ");
    const rateIndex = tokens.findIndex(token => token.includes("%"));
    const itemName = tokens.slice(0, rateIndex).join(" ").trim();

    // 🧩 Composite key: ITEM_NAME|RATE (taxType not applicable here)
    const compositeKey = `${itemName}|${gstRate}`;

    gstItemMap.set(compositeKey, item.id);
  });

  return gstItemMap;
};

exports.categorizeAccountsByGstRate = (accounts) => {
  const categoryAccountMap = new Map(); // Map<string, account_id>

  // 🔹 Composite key format: "ITEM_NAME|RATE|TAX_TYPE"
  accounts.forEach(account => {
    const accountName = account.account_name.toUpperCase();

    const gstRateMatch = accountName.match(/(\d+)%/);
    const gstRate = gstRateMatch ? parseInt(gstRateMatch[1], 10) : 0;

    const taxType = accountName.includes('IGST') ? 'igst' : 'cgst';

    const itemMatch = accountName.match(/OF\s+(.*?)\s+\d+%/);
    const itemName = itemMatch ? itemMatch[1].trim().toUpperCase() : 'UNKNOWN';

    const compositeKey = `${itemName}|${gstRate}|${taxType}`;
    categoryAccountMap.set(compositeKey, account.account_id);
  });

  return categoryAccountMap;
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
  type,
  taxType
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
      const itemName = extractedData["ItemName"];
      // console.log(itemName);
      const compositeKey = `${itemName}|${rate}|${taxType}`;
      // console.log(compositeKey);
      const itemCompositeKey = `${itemName}|${rate}`;
      // console.log(itemCompositeKey);
      // Retrieve mappings for this GST rate
      const categoryId = gstCategoryMap.get(compositeKey);
      // console.log(categoryId);
      const itemId = gstItemMap.get(itemCompositeKey);
      // console.log(itemId);
      const categoryAccountId = categoryAccountMap.get(compositeKey);
      // console.log(categoryAccountId);
      const unitId = unitIdMap.get(categoryId);
      // console.log(unitId);

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
        const taxPercentageMatch = field_name.match(/(\d+(\.\d+)?)%/); // Match percentage like "2.5%","5%","18%"
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
