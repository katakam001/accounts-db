const fs = require('fs');
const { parse } = require('json2csv');

// Load the JSON data from the file

const path = require('path');

const dataPath = path.join(__dirname, './json/account_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Prepare data for account_list CSV
const accountListData = data.map(entry => ({
    id: entry.id,
    name: entry.name,
    gst_no: entry.gst_no,
    user_id: entry.user_id,
    credit_balance: entry.credit_balance,
    debit_balance: entry.debit_balance,
    financial_year: entry.financial_year,
    isDealer: entry.isDealer,
    type: null,
    createdAt: new Date(),
    updatedAt: new Date()
}));

// Prepare data for account_group CSV
const accountGroupData = data.map(entry => ({
    account_id: entry.id,
    group_id: entry.group.id,
    createdAt: new Date(),
    updatedAt: new Date()
}));

// Prepare data for addresses CSV (if address is not null)
const addressData = data
    .filter(entry => entry.address)
    .map(entry => ({
        account_id: entry.id,
        street: entry.address.street,
        city: entry.address.city,
        state: entry.address.state,
        postal_code: entry.address.postal_code,
        country: entry.address.country,
        createdAt: new Date(),
        updatedAt: new Date()
    }));

// Define fields for each CSV
const accountListFields = ['id', 'name', 'gst_no', 'user_id', 'credit_balance', 'debit_balance', 'financial_year', 'isDealer', 'type', 'createdAt', 'updatedAt'];
const accountGroupFields = ['account_id', 'group_id', 'createdAt', 'updatedAt'];
const addressFields = ['account_id', 'street', 'city', 'state', 'postal_code', 'country', 'createdAt', 'updatedAt'];

// Generate CSV for account_list
const accountListCsv = parse(accountListData, { fields: accountListFields });
fs.writeFileSync('account_list_data.csv', accountListCsv);
console.log('Data formatted and saved to account_list_data.csv');

// Generate CSV for account_group
const accountGroupCsv = parse(accountGroupData, { fields: accountGroupFields });
fs.writeFileSync('account_group_data.csv', accountGroupCsv);
console.log('Data formatted and saved to account_group_data.csv');

// Generate CSV for addresses (if address is not null)
if (addressData.length > 0) {
    const addressCsv = parse(addressData, { fields: addressFields });
    fs.writeFileSync('addresses_data.csv', addressCsv);
    console.log('Data formatted and saved to addresses_data.csv');
} else {
    console.log('No address data to save.');
}
