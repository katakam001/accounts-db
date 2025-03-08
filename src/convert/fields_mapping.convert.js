const fs = require('fs');
const { parse } = require('json2csv');

// Load the JSON data from the file
const path = require('path');

const dataPath = path.join(__dirname, './json/fields_mapping_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));


data.forEach(entry => {
  if (!entry.hasOwnProperty('type')) {
    entry['type'] = 1;
  }
  if (!entry.hasOwnProperty('user_id')) {
    entry['user_id'] = 9;
  }
  if (!entry.hasOwnProperty('financial_year')) {
    entry['financial_year'] = "2024-2025";
  }
});

// Define the fields you want in the CSV
const fields = ['id', 'category_id','field_id','field_type','required','field_category','exclude_from_total','type', 'user_id', 'financial_year', 'createdAt', 'updatedAt'];
const csv = parse(data, { fields });

// Save CSV data to a file
fs.writeFileSync('fields_mapping_data.csv', csv);
console.log('Data formatted and saved to fields_mapping_data.csv');
