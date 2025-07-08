'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(sequelize, Sequelize) {
    // Create default_group_mapping table
    await sequelize.bulkInsert('default_group_mapping', [
      { parent_name: null, group_name: 'Current Liabilities', hierarchy_level: 1 },
      { parent_name: 'Current Liabilities', group_name: 'Liability For Expense', hierarchy_level: 2 },
      { parent_name: 'Liability For Expense', group_name: 'Provisions', hierarchy_level: 3 },
      { parent_name: 'Current Liabilities', group_name: 'God', hierarchy_level: 2 },
      { parent_name: 'Current Liabilities', group_name: 'Sundry Creditors', hierarchy_level: 2 },
      { parent_name: 'Current Liabilities', group_name: 'Unsecured Loans', hierarchy_level: 2 },
      { parent_name: null, group_name: 'Current Assets', hierarchy_level: 1 },
      { parent_name: 'Current Assets', group_name: 'Loans and Advances', hierarchy_level: 2 },
      { parent_name: 'Loans and Advances', group_name: 'Advance For Expenses', hierarchy_level: 3 },
      { parent_name: 'Current Assets', group_name: 'Stock In Hand', hierarchy_level: 2 },
      { parent_name: 'Stock In Hand', group_name: 'Inventories', hierarchy_level: 3 },
      { parent_name: 'Current Assets', group_name: 'Sundry Debtors', hierarchy_level: 2 },
      { parent_name: 'Sundry Debtors', group_name: 'Above 3 months', hierarchy_level: 3 },
      { parent_name: 'Sundry Debtors', group_name: 'Below 3 months', hierarchy_level: 3 },
      { parent_name: 'Current Assets', group_name: 'Deposits', hierarchy_level: 2 },
      { parent_name: 'Current Assets', group_name: 'Bank Account', hierarchy_level: 2 },
      { parent_name: 'Current Assets', group_name: 'Investments', hierarchy_level: 2 },
      { parent_name: 'Current Assets', group_name: 'Cash On Hand', hierarchy_level: 2 },
      { parent_name: null, group_name: 'Profit & Loss A/C', hierarchy_level: 1 },
      { parent_name: 'Profit & Loss A/C', group_name: 'Indirect Expenses', hierarchy_level: 2 },
      { parent_name: 'Profit & Loss A/C', group_name: 'Indirect Income', hierarchy_level: 2 },
      { parent_name: 'Profit & Loss A/C', group_name: 'Salaries', hierarchy_level: 2 },
      { parent_name: null, group_name: 'Trading Account', hierarchy_level: 1 },
      { parent_name: 'Trading Account', group_name: 'Closing Stock', hierarchy_level: 2 },
      { parent_name: 'Trading Account', group_name: 'Opening Stock', hierarchy_level: 2 },
      { parent_name: 'Trading Account', group_name: 'Direct Expenses', hierarchy_level: 2 },
      { parent_name: 'Trading Account', group_name: 'Depreciation', hierarchy_level: 2 },
      { parent_name: 'Trading Account', group_name: 'Direct Income', hierarchy_level: 2 },
      { parent_name: 'Trading Account', group_name: 'Purchase Account', hierarchy_level: 2 },
      { parent_name: 'Trading Account', group_name: 'Sale Account', hierarchy_level: 2 },
      { parent_name: 'Trading Account', group_name: 'Purchase Return Account', hierarchy_level: 2 },
      { parent_name: 'Trading Account', group_name: 'Sale Return Account', hierarchy_level: 2 },
      { parent_name: 'Trading Account', group_name: 'Credit Note Account', hierarchy_level: 2 },
      { parent_name: 'Trading Account', group_name: 'Debit Note Account', hierarchy_level: 2 },
      { parent_name: null, group_name: 'Capital Account', hierarchy_level: 1 },
      { parent_name: 'Capital Account', group_name: 'Reserves & Surplus', hierarchy_level: 2 },
      { parent_name: null, group_name: 'Secured Loans', hierarchy_level: 1 },
      { parent_name: 'Secured Loans', group_name: 'Bank OCC', hierarchy_level: 2 },
      { parent_name: 'Indirect Expenses', group_name: 'CGST', hierarchy_level: 3 },
      { parent_name: 'Indirect Expenses', group_name: 'SGST', hierarchy_level: 3 },
      { parent_name: 'Indirect Expenses', group_name: 'IGST', hierarchy_level: 3 },
    ]);
  },

  down: async (sequelize, Sequelize) => {
    // Drop tables in reverse order
    await sequelize.bulkDelete('default_group_mapping', null, {});
  },
};
