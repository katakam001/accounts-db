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
      const je = await db.journalEntry.findOne({
        where: { transaction_id: log.transaction_id }
      });
      if (!je) continue;

      const d = new Date(je.journal_date);
      const formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

      const jiRows = await db.journalItem.findAll({
        where: { journal_id: je.id }
      });
      if (jiRows.length === 0) continue;

     // const ji = jiRows[0];
     // const description = ji.narration;
     // const finalAmount = ji.amount.toString();
     // const userId = je.user_id.toString();

      const accountIds = jiRows.map(r => r.account_id);
      const accounts = await db.account.findAll({
        where: { id: accountIds },
        attributes: ['id', 'name']
      });

      const result = detectBank(accounts);
      const accountId = result.id.toString();
	    // Find the journal item that matches the detected accountId
const matchedJi = jiRows.find(r => r.account_id === result.id);

// Now use the matched journal item
const description = matchedJi.narration;
const finalAmount = matchedJi.amount.toString();
const userId = je.user_id.toString();

      const fingerprint = `${formattedDate}|${description.trim()}|${finalAmount}`;
      const scopedInput = `${accountId}|${userId}|${je.financial_year}|${fingerprint}`;
      const newTxId = generateReference(scopedInput);

      if (log.transaction_id !== newTxId) {
        mismatchCount++;

        // 🔥 Update uploaded_file_log with new transaction_id and regenerated hash
        const newHash = generateUniqueId(newTxId, je.user_id, je.financial_year, log.type);
        console.log(`Updated log.id=${log.id} → transaction_id=${newTxId}, hash=${newHash}`);


	            // Step 3: Update both tables in a transaction
      await db.sequelize.transaction(async (t) => {
        await db.uploadedFileLog.update(
          { transaction_id: newTxId, hash: newHash },
          { where: { id: log.id }, transaction: t }
        );

        await db.journalEntry.update(
          { transaction_id: newTxId },
          { where: { id: je.id }, transaction: t }
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

