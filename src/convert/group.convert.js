const fs = require('fs');
const { parse } = require('json2csv');

// Load the JSON data from the file
const path = require('path');

const dataPath = path.join(__dirname, './data/group_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Define the fields you want in the CSV
const fields = ['id', 'name','description', 'user_id','credit_balance','debit_balance', 'financial_year', 'createdAt', 'updatedAt'];
const csv = parse(data, { fields });

// Save CSV data to a file
fs.writeFileSync('group_data.csv', csv);
console.log('Data formatted and saved to group_data.csv');
