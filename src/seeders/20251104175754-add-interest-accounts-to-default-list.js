'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('default_account_list', [
      {
        name: 'Interest on Capital',
        credit_balance: 0.0,
        debit_balance: 0.0,
        isDealer: false,
        type: 4
      },
      {
        name: 'Interest Received',
        credit_balance: 0.0,
        debit_balance: 0.0,
        isDealer: false,
        type: 4
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('default_account_list', {
      name: {
        [Sequelize.Op.in]: ['Interest on Capital', 'Interest Received']
      }
    });
  }
};
