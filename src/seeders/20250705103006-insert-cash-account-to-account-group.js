'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove old mapping
    await queryInterface.bulkDelete('default_account_group', {
      account_name: 'CASH',
      group_name: 'Salaries'
    });

    // Insert new mapping
    await queryInterface.bulkInsert('default_account_group', [
      {
        account_name: 'CASH',
        group_name: 'Cash On Hand'
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Revert: delete the new mapping and reinsert the old one
    await queryInterface.bulkDelete('default_account_group', {
      account_name: 'CASH',
      group_name: 'Cash On Hand'
    });

    await queryInterface.bulkInsert('default_account_group', [
      {
        account_name: 'CASH',
        group_name: 'Salaries'
      }
    ]);
  }
};
