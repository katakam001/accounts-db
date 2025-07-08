'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('default_group_list', [
      {
        name: 'Farmer Creditors',
        description: null,
        credit_balance: 0.0,
        debit_balance: 0.0
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('default_group_list', {
      name: 'Farmer Creditors'
    });
  }
};
