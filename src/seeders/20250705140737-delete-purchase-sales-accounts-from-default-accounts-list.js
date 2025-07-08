'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ❌ Delete specified accounts
    await queryInterface.bulkDelete('default_account_list', {
      [Sequelize.Op.or]: [
        { name: 'Purchase Account' },
        { name: 'Sales Account' }
      ]
    });
  },

  async down(queryInterface, Sequelize) {
    // 🔁 Restore them if needed
    await queryInterface.bulkInsert('default_account_list', [
      {
        name: 'Purchase Account',
        credit_balance: 0.0,
        debit_balance: 0.0,
        isDealer: false,
        type: 4
      },
      {
        name: 'Sales Account',
        credit_balance: 0.0,
        debit_balance: 0.0,
        isDealer: false,
        type: 4
      }
    ]);
  }
};
