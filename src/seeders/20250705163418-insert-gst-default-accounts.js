'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('default_account_list', [
      { name: 'SGST 2.5%', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'CGST 2.5%', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'SGST 6%',   credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'CGST 6%',   credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'SGST 9%',   credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: 'CGST 9%',   credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('default_account_list', {
      name: {
        [Sequelize.Op.in]: [
          'SGST 2.5%',
          'CGST 2.5%',
          'SGST 6%',
          'CGST 6%',
          'SGST 9%',
          'CGST 9%'
        ]
      }
    });
  }
};
