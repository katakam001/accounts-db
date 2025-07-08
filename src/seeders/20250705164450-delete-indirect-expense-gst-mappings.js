'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const Op = Sequelize.Op;

    // 🧹 Delete from default_account_group
    await queryInterface.bulkDelete('default_account_group', {
      [Op.or]: [
        { account_name: 'RCM CGST', group_name: 'Indirect Expenses' },
        { account_name: 'RCM IGST', group_name: 'Indirect Expenses' },
        { account_name: 'RCM SGST', group_name: 'Indirect Expenses' },
        { account_name: 'SGST', group_name: 'Indirect Expenses' },
        { account_name: 'IGST', group_name: 'Indirect Expenses' },
        { account_name: 'CGST', group_name: 'Indirect Expenses' }
      ]
    });

    // 🧹 Delete from default_account_list
    await queryInterface.bulkDelete('default_account_list', {
      name: {
        [Op.in]: [
          'RCM CGST',
          'RCM IGST',
          'RCM SGST',
          'SGST',
          'IGST',
          'CGST'
        ]
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // 🔁 Restore both tables
    await queryInterface.bulkInsert('default_account_list', [
      { name: 'RCM CGST', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'RCM IGST', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'RCM SGST', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'SGST',     credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'IGST',     credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'CGST',     credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 }
    ]);

    await queryInterface.bulkInsert('default_account_group', [
      { account_name: 'RCM CGST', group_name: 'Indirect Expenses' },
      { account_name: 'RCM IGST', group_name: 'Indirect Expenses' },
      { account_name: 'RCM SGST', group_name: 'Indirect Expenses' },
      { account_name: 'SGST',     group_name: 'Indirect Expenses' },
      { account_name: 'IGST',     group_name: 'Indirect Expenses' },
      { account_name: 'CGST',     group_name: 'Indirect Expenses' }
    ]);
  }
};
