'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ❌ Delete incorrect entry
    await queryInterface.bulkDelete('default_group_list', {
      name: 'Liability For Expense'
    });

    // ✅ Insert corrected entry
    await queryInterface.bulkInsert('default_group_list', [
      {
        name: 'Liability For Expenses',
        description: null,
        credit_balance: 0.0,
        debit_balance: 0.0
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // 🔁 Restore old entry & remove corrected one
    await queryInterface.bulkDelete('default_group_list', {
      name: 'Liability For Expenses'
    });

    await queryInterface.bulkInsert('default_group_list', [
      {
        name: 'Liability For Expense',
        description: null,
        credit_balance: 0.0,
        debit_balance: 0.0
      }
    ]);
  }
};
