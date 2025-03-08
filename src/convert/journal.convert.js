const fs = require('fs');
const { parse } = require('json2csv');
const path = require('path');

const dataPath = path.join(__dirname, './json/journal_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));


// Prepare data for journal_entries CSV
const journalEntriesData = data.map(entry => ({
    id: entry.id,
    journal_date: entry.journal_date,
    description: entry.description,
    user_id: entry.user_id || 9,
    financial_year: entry.financial_year || "2024-2025",
    type: 2,
    createdAt: new Date(),
    updatedAt: new Date()
}));

// Prepare data for journal_items CSV
const journalItemsData = data.flatMap(entry => 
    entry.items.map(item => ({
        journal_id: item.journal_id,
        account_id: item.account_id,
        group_id: item.group_id,
        amount: item.amount,
        type: item.type,
        createdAt: new Date(),
        updatedAt: new Date()
    }))
);

// Define fields for each CSV
const journalEntriesFields = ['id', 'journal_date', 'description', 'user_id', 'financial_year', 'type', 'createdAt', 'updatedAt'];
const journalItemsFields = ['journal_id', 'account_id', 'group_id', 'amount', 'type', 'createdAt', 'updatedAt'];

// Generate CSV for journal_entries
const journalEntriesCsv = parse(journalEntriesData, { fields: journalEntriesFields });
fs.writeFileSync('journal_entries.csv', journalEntriesCsv);
console.log('Data formatted and saved to journal_entries.csv');

// Generate CSV for journal_items
const journalItemsCsv = parse(journalItemsData, { fields: journalItemsFields });
fs.writeFileSync('journal_items.csv', journalItemsCsv);
console.log('Data formatted and saved to journal_items.csv');
