const fs = require('fs');
const { parse } = require('json2csv');

// Load the JSON data from the file
const path = require('path');

const dataPath = path.join(__dirname, './json/categories_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Define the fields you want in the CSV
const fields = ['id', 'name','type', 'user_id', 'financial_year', 'createdAt', 'updatedAt'];
const csv = parse(data, { fields });

// Save CSV data to a file
fs.writeFileSync('categories_data.csv', csv);
console.log('Data formatted and saved to categories_data.csv');
