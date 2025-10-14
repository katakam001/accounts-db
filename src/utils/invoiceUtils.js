const moment = require('moment-timezone');

exports.categorizeCategoriesByTaxRate = (categories) => {
  const gstCategoryMap = new Map();

  for (const category of categories) {
    const name = category.name.toUpperCase();

    // 🔍 Determine tax type
    let taxType = 'cgst';
    if (name.includes('IGST')) {
      taxType = 'igst';
    } else if (name.includes('TCS')) {
      taxType = 'tcs';
    }

    // 🔍 Extract rate based on tax type
    let rate = 0;
    if (taxType === 'tcs') {
      const taxRateMatch = name.match(/(\d+(\.\d+)?)%/);
      rate = taxRateMatch ? parseFloat(taxRateMatch[1]) : 0;
    } else {
      const gstRateMatch = name.match(/(\d+)%/);
      rate = gstRateMatch ? parseInt(gstRateMatch[1], 10) : 0;
    }

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
    const compositeKey = `${itemName}|${rate}|${taxType}`;

    gstCategoryMap.set(compositeKey, category.id);
  }

  return gstCategoryMap;
};

exports.categorizeItemsByTaxRate = (items) => {
  const gstItemMap = new Map(); // Map<string, item_id>

  items.forEach((item) => {
    const name = item.name.toUpperCase().trim(); // Consistent casing

    const taxRateMatch = name.match(/(\d+(\.\d+)?)%/); // Handles both integer and decimal rates
    const taxRate = taxRateMatch ? parseFloat(taxRateMatch[1]) : 0;


    // 🔍 Extract item name: all words before the GST rate token
    const tokens = name.split(" ");
    const rateIndex = tokens.findIndex(token => token.includes("%"));
    const itemName = tokens.slice(0, rateIndex).join(" ").trim();

    // 🧩 Composite key: ITEM_NAME|RATE (taxType not applicable here)
    const compositeKey = `${itemName}|${taxRate}`;

    gstItemMap.set(compositeKey, item.id);
  });

  return gstItemMap;
};

exports.categorizeAccountsByTaxRate = (accounts) => {
  const categoryAccountMap = new Map(); // Map<string, account_id>

  accounts.forEach(account => {
    const accountName = account.account_name.toUpperCase();

    // 🔍 Determine tax type
    let taxType = 'cgst';
    if (accountName.includes('IGST')) {
      taxType = 'igst';
    } else if (accountName.includes('TCS')) {
      taxType = 'tcs';
    }

    // 🔍 Extract rate based on tax type
    let rate = 0;
    if (taxType === 'tcs') {
      const taxRateMatch = accountName.match(/(\d+(\.\d+)?)%/);
      rate = taxRateMatch ? parseFloat(taxRateMatch[1]) : 0;
    } else {
      const gstRateMatch = accountName.match(/(\d+)%/);
      rate = gstRateMatch ? parseInt(gstRateMatch[1], 10) : 0;
    }

    // 🔍 Extract item name based on tax type
    let itemName = 'UNKNOWN';
    if (taxType === 'tcs') {
      const itemMatch = accountName.match(/OF\s+(.*?)\s+\d+(\.\d+)?%/);
      itemName = itemMatch ? itemMatch[1].trim().toUpperCase() : 'UNKNOWN';
    } else {
      const itemMatch = accountName.match(/OF\s+(.*?)\s+\d+%/);
      itemName = itemMatch ? itemMatch[1].trim().toUpperCase() : 'UNKNOWN';
    }

    // 🔑 Composite key
    const compositeKey = `${itemName}|${rate}|${taxType}`;
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
  if (taxType === 'tcs') {
    // 🔹 For TCS: loop through each item in the invoice
    extractedData.items.forEach(item => {
      const itemName = item.itemName;
      const unitName = item.unitName?.toLowerCase().trim(); // normalize input


      const rate = parseFloat(item.taxRate);
      const compositeKey = `${itemName}|${rate}|${taxType}`;
      const itemCompositeKey = `${itemName}|${rate}`;

      const categoryId = gstCategoryMap.get(compositeKey);
      const itemId = gstItemMap.get(itemCompositeKey);
      const categoryAccountId = categoryAccountMap.get(compositeKey);
      const unitEntries = unitIdMap.get(categoryId) || [];
      const matchedUnit = unitEntries.find(u => u.name === unitName);
      const unitId = matchedUnit?.id;

      if (!categoryId || !itemId || !categoryAccountId || !unitId) {
        console.error(`Missing mapping for TCS item ${itemName} at rate ${rate}`);
        return;
      }

      const accountNameKey = extractedData.Name.toLowerCase();
      const account = accountMap.get(accountNameKey) || accountMap.get(suspenseAccountName.toLowerCase());
      const customerName = accountMap.has(accountNameKey) ? extractedData.Name : suspenseAccountName;

      const dynamicFields = createDynamicFields(categoryId, dynamicFieldsMap, item, item.amount, item.tax, taxType);
      const quantity = parseFloat(Number(item.quantity).toFixed(4));

      const entry = {
        s_no: parseInt(extractedData.SNo, 10),
        category_id: categoryId,
        item_id: itemId,
        quantity: quantity,
        unit_id: unitId,
        unit_price: item.rate,
        value: item.amount,
        total_amount: item.total_amount,
        category_account_id: categoryAccountId,
        entry_date: moment(extractedData.FeedDate, 'DD/MM/YYYY').tz('Asia/Kolkata').set({ hour: 5, minute: 30, second: 0 }).format('YYYY-MM-DD HH:mm:ss.SSS Z'),
        user_id: userId,
        type,
        financial_year: financialYear,
        invoiceNumber: extractedData.FeedNo,
        account_id: account ? account.accountId : null,
        customerName,
        dynamicFields,
      };

      entries.push(entry);
    });
  } else {
    // 🔹 For CGST/IGST: use existing logic
    // Define GST fields and rates
    const gstFields = [
      { rate: 0, valueKey: 'GstValue0' },
      { rate: 5, valueKey: 'GstValue5', field: "gst5" },
      { rate: 12, valueKey: 'GstValue12', field: "gst12" },
      { rate: 18, valueKey: 'GstValue18', field: "gst18" },
      { rate: 28, valueKey: 'GstValue28', field: "gst28" },
    ];

    gstFields.forEach(({ rate, valueKey, field }) => {
      // console.log(extractedData);
      // console.log(extractedData[valueKey]);
      const gstValue = extractedData[valueKey]; // Get the GST value for this rate
      const gst = field ? extractedData[field] : 0;
      // console.log(gstValue);
      if (gstValue > 0) {
        const itemName = extractedData["ItemName"];
        const unitName = extractedData["UnitName"]?.toLowerCase().trim();

        // console.log(itemName);
        // console.log(unitName);
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
        const unitEntries = unitIdMap.get(categoryId) || [];
        const matchedUnit = unitEntries.find(u => u.name === unitName);
        const unitId = matchedUnit?.id;
        // console.log(unitId);

        if (!categoryId || !itemId || !categoryAccountId || !unitId) {
          console.error(`Missing mapping for GST rate ${rate}`);
          return;
        }

        // Retrieve account_id using extractedData.Name (lowercase) or use Suspense Account
        const accountNameKey = extractedData.Name.toLowerCase();
        const account = type === 8 ? accountMap.get(accountNameKey) || null : accountMap.get(accountNameKey) || accountMap.get(suspenseAccountName.toLowerCase());
        const customerName = accountMap.has(accountNameKey) ? extractedData.Name : suspenseAccountName;
        if (!account) {
          console.error(`Missing account ID for Name: ${accountNameKey}. Defaulting to Suspense Account.`);
        }

        // Generate dynamic fields for this entry
        const dynamicFields = createDynamicFields(categoryId, dynamicFieldsMap, extractedData, gstValue, gst, taxType);

        const quantity = parseFloat(Number(extractedData.Quantity).toFixed(4));


        // Construct the entry
        const entry = {
          s_no: parseInt(extractedData.SNo, 10),
          category_id: categoryId,
          item_id: itemId,
          quantity: quantity,
          unit_id: unitId,
          unit_price: parseFloat((type === 8 ? (gstValue + gst) / quantity : gstValue / quantity).toFixed(2)),
          value: gstValue,
          total_amount: parseFloat((gstValue + gst).toFixed(2)),
          category_account_id: categoryAccountId,
          entry_date: moment(extractedData.FeedDate, 'DD/MM/YYYY').tz('Asia/Kolkata').set({ hour: 5, minute: 30, second: 0 }).format('YYYY-MM-DD HH:mm:ss.SSS Z'),
          user_id: userId,
          type, // Hardcoded type
          financial_year: financialYear,
          invoiceNumber: extractedData.FeedNo, // Invoice number from extractedData
          account_id: account ? account.accountId : null, // ✅ Safe fallback
          customerName: customerName,
          dynamicFields, // Populate dynamic fields here
        };

        entries.push(entry); // Add the entry to the entries array
      }
    });
  }
  // console.log(entries);
  return entries;
};
const createDynamicFields = (categoryId, dynamicFieldsMap, extractedData, gstValue, gst, taxType) => {
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
        let field_value = "0.00";

        if (taxType === 'igst') {
          field_value = gst.toFixed(2);
        } if (taxType === 'tcs') {
          field_value = gst.toFixed(2);
        } else {
          // Calculate expected tax value from NetAmt
          const calculatedTax = parseFloat((gstValue * taxPercentage / 100).toFixed(2));
          const actualTax = parseFloat((gst / 2).toFixed(2)); // CGST or SGST portion

          const difference = Math.abs(calculatedTax - actualTax);

          // If difference exceeds tolerance, log warning (optional)
          if (difference > 0.25) {
            console.warn(
              `Tax mismatch for field "${field_name}": Expected ${actualTax}, Calculated ${calculatedTax}, Difference ${difference}`
            );
          }

          // Use actual tax value for CGST/SGST
          field_value = actualTax.toFixed(2);
        }

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
