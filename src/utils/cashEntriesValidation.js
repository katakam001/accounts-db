const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { getDb } = require("./getDb");

dotenv.config({
  path: path.resolve(__dirname, `../../.env.${process.env.NODE_ENV || 'production'}`)
});

const banks = [
  'ANDHRA PRAGATHI GRAMEENA BANK',
  'AXIS BANK',
  'BANK OF BARODA',
  'BANK OF INDIA',
  'CANARA BANK',
  'CENTRAL BANK OF INDIA',
  'CITY UNION BANK',
  'HDFC BANK',
  'ICICI BANK',
  'IDFC FIRST BANK',
  'INDIAN BANK',
  'INDIAN OVERSEAS BANK',
  'KARUR VYSYA BANK',
  'SBI',
  'TAMILNAD MERCANTILE BANK LTD',
  'UNION BANK OF INDIA'
];

// Detect bank from a pair of accountNames
function detectBank(accounts) {
  for (const account of accounts) {
    const upperName = account.name.toUpperCase().trim();

    // priority exact matches
    if (upperName.includes('CENTRAL BANK OF INDIA') ||upperName.includes('CENTRAL BANK')) {
      return { bank: 'CENTRAL BANK OF INDIA', accountName: account.name,id:account.id };
    }
    if (upperName.includes('STATE BANK OF INDIA')) {
      return { bank: 'SBI', accountName: account.name,id:account.id };
    }
    if (upperName.includes('UNION BANK OF INDIA')) {
      return { bank: 'UNION BANK OF INDIA', accountName: account.name,id:account.id };
    }

    if (upperName.includes('IB GL')) {
      return { bank: 'INDIAN BANK', accountName: account.name,id:account.id };
    }

    // fuzzy rules
    if (upperName.includes('CBI')) {
      return { bank: 'CENTRAL BANK OF INDIA', accountName: account.name,id:account.id };
    }
    if (upperName.includes('HDFC')) {
      return { bank: 'HDFC BANK', accountName: account.name,id:account.id };
    }
    if (upperName.includes('UBI')) {
      return { bank: 'UNION BANK OF INDIA', accountName: account.name,id:account.id };
    }
           // special remap: Andhra Pragathi → Andhra Pradesh Grameena Bank
    if (upperName.includes('ANDHRA PRAGATHI GRAMEENA BANK')) {
      return { bank: 'ANDHRA PRADESH GRAMEENA BANK', accountName: account.name,id:account.id };
      //return { bank: 'ANDHRA PRAGATHI GRAMEENA BANK', accountName: account.name,id:account.id };
    }

    // direct matches (safe after priority rules)
    const match = banks.find(bank => upperName.includes(bank));
    if (match) return { bank: match, accountName: account.name,id:account.id };
  }

  return { bank: 'UNKNOWN', accountName: null,id:null };
}

function generateReference(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

(async () => {
  const db = getDb();

  try {
    const logs = await db.uploadedFileLog.findAll({
            where: { type: 0 }
    });

    let unknownCount = 0;
    let mismatchCount = 0;
    let matchCount = 0;
    let mismatch = 0;
    const accountBankMap = new Map();
    const accountMismatchMap = new Map();
          const mismatchSummary = new Map();

for (const log of logs) {
  // Step 1: fetch ALL entries for this transaction_id
  const entries = await db.cashEntriesBatch.findAll({
    where: { transaction_id: log.transaction_id }
  });
  if (!entries || entries.length === 0) continue;

  // Step 2: collect all unique account_ids
  const accountIds = [...new Set(entries.map(e => e.account_id))];

  // Step 3: fetch all accounts in one go
  const accounts = await db.account.findAll({
    where: { id: accountIds },
    attributes: ['id', 'name']
  });

  // Step 4: detect which account is the bank
  const result = detectBank(accounts);
  const bankName = result.bank;
  const bankAccountId = result.id;
  const accountId = result.id.toString();


  if (bankName === 'UNKNOWN') {
    unknownCount++;
    console.log(`UNKNOWN bank for transaction_id: ${log.transaction_id}`);
    continue;
  }

  // Step 5: find the entry that matches the detected bank account
  const cb = entries.find(e => e.account_id === bankAccountId);
  if (!cb) {
    console.warn(`No entry found for bankAccountId=${bankAccountId}, skipping log.id=${log.id}`);
    continue;
  }

  // Step 6: build fingerprint from that entry
  const d = new Date(cb.cash_date);
  const formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const description = cb.narration;
  const finalAmount = cb.amount.toString();
  const userId = cb.user_id.toString();

  const fingerprint = `${formattedDate}|${description.trim()}|${finalAmount}`;
  const scopedInput = `${accountId}|${userId}|${cb.financial_year}|${fingerprint}`;
  const newTxId = generateReference(scopedInput);

  // Step 7: compare and update counters/maps
  if (log.transaction_id !== newTxId) {
    if (mismatch < 11) {
      console.log(`existing transaction_id: ${log.transaction_id}`);
      console.log(`new transaction_id: ${newTxId}`);
      console.log(`bankName: ${bankName}`);
      console.log(`accountName: ${result.accountName}`);
      console.log(`accountId: ${result.id}`);
      console.log(`scopedInput: ${scopedInput}`);
      console.log(`formattedDate: ${formattedDate}`);
    }

    mismatchCount++;
    mismatch++;

    // key by user_id + financial_year
    const key = `${userId}|${cb.financial_year}`;
    mismatchSummary.set(key, (mismatchSummary.get(key) || 0) + 1);

    accountMismatchMap.set(
      result.accountName,
      (accountMismatchMap.get(result.accountName) || 0) + 1
    );
  } else {
    matchCount++;
    // Save only the matched accountName → bankName
    if (!accountBankMap.has(result.accountName)) {
      accountBankMap.set(result.accountName, result.bank);
    }
  }
}

    console.log(`Entries with UNKNOWN bank: ${unknownCount}`);
    console.log(`Entries where existing transaction_id != regenerated : ${mismatchCount}`);
    console.log(`Entries where existing transaction_id = regenerated ): ${matchCount}`);

    console.log("\n=== AccountName → BankName Map ===");
    for (const [accountName, bankName] of accountBankMap.entries()) {
      console.log(`${accountName} → ${bankName}`);
    }
          console.log("\n=== Mismatch Summary by user_id + financial_year ===");
for (const [key, count] of mismatchSummary.entries()) {
  const [userId, finYear] = key.split('|');
  console.log(`user_id=${userId}, financial_year=${finYear} → ${count} mismatches`);
}
          console.log("\n=== Mismatch Summary by accountName ===");
for (const [key, count] of accountMismatchMap.entries()) {
  console.log(`accountName=${key} → ${count} mismatches`);
}

  } catch (err) {
    console.error(err);
  } finally {
    await db.sequelize.close();
  }
})();
