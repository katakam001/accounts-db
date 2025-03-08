const fs = require('fs');
const { parse } = require('json2csv');


const path = require('path');

const dataPath = path.join(__dirname, './json/entries_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Prepare data for entries CSV
const entriesData = data.map(entry => ({
    id: entry.id,
    category_id: entry.category_id,
    entry_date: entry.entry_date,
    account_id: entry.account_id,
    item_id: entry.item_id,
    quantity: entry.quantity,
    unit_price: entry.unit_price,
    total_amount: entry.total_amount,
    value: entry.value,
    user_id: entry.user_id,
    financial_year: entry.financial_year,
    unit_id: entry.unit_id,
    journal_id: entry.journal_id,
    type: entry.type,
    createdAt: new Date(),
    updatedAt: new Date()
}));

// Prepare data for entry_fields CSV
const entryFieldsData = data.flatMap(entry => 
    entry.fields.map(field => ({
        entry_id: entry.id,
        field_id: field.field_id,
        field_value: field.field_value,
        createdAt: new Date(),
        updatedAt: new Date()
    }))
);

// Define fields for each CSV
const entriesFields = ['id', 'category_id', 'entry_date', 'account_id', 'item_id', 'quantity', 'unit_price', 'total_amount', 'value', 'user_id', 'financial_year', 'unit_id', 'journal_id', 'type', 'createdAt', 'updatedAt'];
const entryFieldsFields = ['entry_id', 'field_id', 'field_value', 'createdAt', 'updatedAt'];

// Generate CSV for entries
const entriesCsv = parse(entriesData, { fields: entriesFields });
fs.writeFileSync('entries_data.csv', entriesCsv);
console.log('Data formatted and saved to entries_data.csv');

// Generate CSV for entry_fields
const entryFieldsCsv = parse(entryFieldsData, { fields: entryFieldsFields });
fs.writeFileSync('entry_fields_data.csv', entryFieldsCsv);
console.log('Data formatted and saved to entry_fields_data.csv');
