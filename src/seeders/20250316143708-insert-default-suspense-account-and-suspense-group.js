'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (sequelize, Sequelize) {
    await sequelize.bulkInsert('default_account_list', [
      { name: 'Suspense Account',credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
    ]);

    // Insert data into default_group_list table
    await sequelize.bulkInsert('default_group_list', [
      { name: 'Suspense', description: null, credit_balance: 0.0, debit_balance: 0.0 }
    ]);
    await sequelize.bulkInsert('default_account_group', [
      { account_name: 'Suspense Account', group_name: 'Suspense' },
    ]);
  },

  async down (sequelize, Sequelize) {
    await sequelize.bulkDelete('default_account_list', null, {});
    await sequelize.bulkDelete('default_group_list', null, {});
    await sequelize.bulkDelete('default_account_group', null, {});
  }
};
