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

      //const ji = jiRows[0];
      //const description = ji.narration;
      //const finalAmount = ji.amount.toString();
      //const userId = je.user_id.toString();

      const accountIds = jiRows.map(r => r.account_id);
	    const accounts = await db.account.findAll({
  where: { id: accountIds },
  attributes: ['id', 'name']   // ✅ only fetch id and name
});



      const result = detectBank(accounts);
      const bankName = result.bank;
      const accountId = result.id.toString();
// Find the journal item that matches the detected accountId
const matchedJi = jiRows.find(r => r.account_id === result.id);

// Now use the matched journal item
const description = matchedJi.narration;
const finalAmount = matchedJi.amount.toString();
const userId = je.user_id.toString();

      if (bankName === 'UNKNOWN') {
        unknownCount++;
        console.log(`UNKNOWN bank for transaction_id: ${log.transaction_id}`);
      } else {
        // Save only the matched accountName → bankName
        if (!accountBankMap.has(result.accountName)) {
          accountBankMap.set(result.accountName, result.bank);
        }
      }

      const fingerprint = `${formattedDate}|${description.trim()}|${finalAmount}`;
      const scopedInput = `${accountId}|${userId}|${je.financial_year}|${fingerprint}`;
      //const scopedInput = `${bankName}|${userId}|${je.financial_year}|${fingerprint}`;
      const newTxId = generateReference(scopedInput);

      if (log.transaction_id !== newTxId) {
	      if(mismatch < 11){
		      console.log(`existing transaction_id: ${log.transaction_id}`);
		      console.log(newTxId);
		      console.log(bankName);
		      console.log(result.accountName);
		      console.log(result.id);
		      console.log( typeof accountId);
		      console.log(accountId);
      console.log(scopedInput);
	    console.log(formattedDate);
	      }
        mismatchCount++;
	      mismatch++;
	       // key by user_id + financial_year
    const key = `${userId}|${je.financial_year}`;
    mismatchSummary.set(key, (mismatchSummary.get(key) || 0) + 1);
          accountMismatchMap.set(result.accountName,(accountMismatchMap.get(result.accountName) || 0) + 1); 
      }else{
        matchCount++;
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

