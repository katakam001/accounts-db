'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(sequelize, Sequelize) {
    // Create default_account_list table
    await sequelize.bulkInsert('default_account_list', [
      { name: 'Traveling', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Postage and Telephone', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Vehicle Maintenance', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Sadar', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Printing & Stationary', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Insurance', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Taxes & Licenses', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Audit Fees',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Commissions',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Advertisement',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Interest Paid',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Amc cess',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Freight',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Coolie',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Electricity',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Ginning & Pressing Charges',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'RCM SGST',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'RCM CGST',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Lease Rent',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Machine Repair',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'SGST',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'CGST',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'IGST',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'RCM IGST',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Sample Testing Charges',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Bank Charges',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Purchase Account',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'Sales Account',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'CASH',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 }
    ]);

    // Insert data into default_group_list table
    await sequelize.bulkInsert('default_group_list', [
      { name: 'Interest on Capital', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Remuneration to Capital', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Bank Account', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'God', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Sundry Debtors', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Sundry Creditors', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Indirect Expenses', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Capital Account', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Current Assets', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Current Liabilities', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Fixed Assets', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Investments', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Unsecured Loans', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Loans and Advances', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Profit & Loss A/C', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Trading Account', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Secured Loans', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Bank OCC', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Cash On Hand', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Direct Expenses', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Direct Income', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Provisions', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Reserves & Surplus', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Stock In Hand', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Closing Stock', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Opening Stock', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Indirect Income', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Deposits', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Prepaid Expenses', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Inventories', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Liability For Expense', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Above 3 months', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Below 3 months', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Advance For Expenses', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Salaries', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Depreciation', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Purchase Account', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Sale Account', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Purchase Return Account', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Sale Return Account', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Credit Note Account', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'Debit Note Account', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'CGST', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'SGST', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'IGST', description: null, credit_balance: 0.0, debit_balance: 0.0 }
    ]);

    // Insert data into default_fields table
    await sequelize.bulkInsert('default_fields', [
      { field_name: '2.5% CGST' },
      { field_name: '2.5% SGST' },
      { field_name: '5% IGST' },
      { field_name: 'amc no.' },
      { field_name: 'Area' },
      { field_name: 'broker' },
      { field_name: 'invoice no.' },
      { field_name: 'Quality' },
      { field_name: 'RCM 2.5% CGST' },
      { field_name: 'RCM 2.5% SGST' },
      { field_name: 'RCM 5% CGST' },
      { field_name: 'RCM 5% SGST' },
      { field_name: 'way bill no.' },
      { field_name: 'lorry no.' }
    ]);
    // Insert data into default_account_group table
    await sequelize.bulkInsert('default_account_group', [
      { account_name: 'Traveling', group_name: 'Indirect Expenses' },
      { account_name: 'Postage and Telephone', group_name: 'Indirect Expenses' },
      { account_name: 'Vehicle Maintenance', group_name: 'Indirect Expenses' },
      { account_name: 'Sadar', group_name: 'Indirect Expenses' },
      { account_name: 'Printing & Stationary', group_name: 'Indirect Expenses' },
      { account_name: 'Insurance', group_name: 'Indirect Expenses' },
      { account_name: 'Taxes & Licenses', group_name: 'Indirect Expenses' },
      { account_name: 'Audit Fees', group_name: 'Indirect Expenses' },
      { account_name: 'Commissions', group_name: 'Indirect Expenses' },
      { account_name: 'Advertisement', group_name: 'Indirect Expenses' },
      { account_name: 'Interest Paid', group_name: 'Indirect Expenses' },
      { account_name: 'Amc cess', group_name: 'Direct Expenses' },
      { account_name: 'Freight', group_name: 'Direct Expenses' },
      { account_name: 'Coolie', group_name: 'Direct Expenses' },
      { account_name: 'Electricity', group_name: 'Direct Expenses' },
      { account_name: 'Ginning & Pressing Charges', group_name: 'Direct Expenses' },
      { account_name: 'RCM SGST', group_name: 'Indirect Expenses' },
      { account_name: 'RCM CGST', group_name: 'Indirect Expenses' },
      { account_name: 'Lease Rent', group_name: 'Direct Expenses' },
      { account_name: 'Machine Repair', group_name: 'Direct Expenses' },
      { account_name: 'SGST', group_name: 'Indirect Expenses' },
      { account_name: 'CGST', group_name: 'Indirect Expenses' },
      { account_name: 'IGST', group_name: 'Indirect Expenses' },
      { account_name: 'RCM IGST', group_name: 'Indirect Expenses' },
      { account_name: 'CASH', group_name: 'Salaries' },
      { account_name: 'Sample Testing Charges', group_name: 'Direct Expenses' },
      { account_name: 'Bank Charges', group_name: 'Indirect Expenses' },
      { account_name: 'Purchase Account', group_name: 'Trading Account' },
      { account_name: 'Sales Account', group_name: 'Trading Account' }
    ]);
  },

  down: async (sequelize, Sequelize) => {
    // Drop tables in reverse order
    await sequelize.bulkDelete('default_account_list', null, {});
    await sequelize.bulkDelete('default_group_list', null, {});
    await sequelize.bulkDelete('default_fields', null, {});
    await sequelize.bulkDelete('default_account_group', null, {});
  }
};