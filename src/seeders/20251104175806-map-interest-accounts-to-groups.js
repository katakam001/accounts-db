'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('default_account_group', [
      {
        account_name: 'Interest on Capital',
        group_name: 'Indirect Expenses'
      },
      {
        account_name: 'Interest Received',
        group_name: 'Indirect Income'
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('default_account_group', {
      account_name: {
        [Sequelize.Op.in]: ['Interest on Capital', 'Interest Received']
      }
    });
  }
};
