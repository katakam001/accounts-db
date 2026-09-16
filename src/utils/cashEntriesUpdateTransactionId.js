const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { v5: uuidv5 } = require('uuid');   // import uuidv5
const { getDb } = require("./getDb");
// Namespace UUID for v5 (must be a valid UUID string you define once)
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

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
      return { bank: 'ANDHRA PRAGATHI GRAMEENA BANK', accountName: account.name,id:account.id };
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

const generateUniqueId = (transactionId, userId, financialYear, type) => {
  return uuidv5(`${transactionId}-${userId}-${financialYear}-${type}`, NAMESPACE);
};

(async () => {
  const db = getDb();

  try {
    const logs = await db.uploadedFileLog.findAll({
      where: { type: 0 }
    });

    let mismatchCount = 0;
    let matchCount = 0;

for (const log of logs) {
  // Step 1: fetch ALL entries for this transaction_id
  const entries = await db.cashEntriesBatch.findAll({
    where: { transaction_id: log.transaction_id }
  });
  if (!entries || entries.length === 0) continue;

  // Step 2: collect all unique account_ids from these entries
  const accountIds = [...new Set(entries.map(e => e.account_id))];

  // Step 3: fetch all accounts in one go
  const accounts = await db.account.findAll({
    where: { id: accountIds },
    attributes: ['id', 'name']
  });

  // Step 4: detect which account is the "bank"
  const result = detectBank(accounts);
  const bankAccountId = result.id;   // chosen accountId
  const accountId = result.id.toString();

  // Step 5: find the entry that matches this bankAccountId
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

  if (log.transaction_id !== newTxId) {
    mismatchCount++;

    const newHash = generateUniqueId(newTxId, cb.user_id, cb.financial_year, log.type);
    console.log(`Updated log.id=${log.id} → transaction_id=${newTxId}, hash=${newHash}`);

    // Step 7: update both tables in a transaction
    await db.sequelize.transaction(async (t) => {
      await db.uploadedFileLog.update(
        { transaction_id: newTxId, hash: newHash },
        { where: { id: log.id }, transaction: t }
      );

      // update ALL entries for this old transaction_id
      await db.cashEntriesBatch.update(
        { transaction_id: newTxId },
        { where: { transaction_id: log.transaction_id }, transaction: t }
      );
    });
  } else {
    matchCount++;
  }
}
    console.log(`Entries updated (mismatches): ${mismatchCount}`);
    console.log(`Entries unchanged (matches): ${matchCount}`);

  } catch (err) {
    console.error(err);
  } finally {
    await db.sequelize.close();
  }
})();
