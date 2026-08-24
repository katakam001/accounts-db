'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Insert into default_group_list
    await queryInterface.bulkInsert('default_group_list', [
      { name: 'Interest Receivable', description: null, credit_balance: 0.0, debit_balance: 0.0 }
    ]);

    // Insert into default_group_mapping
    await queryInterface.bulkInsert('default_group_mapping', [
      {
        parent_name: 'Current Assets',
        group_name: 'Interest Receivable',
        hierarchy_level: 2
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('default_group_mapping', {
      parent_name: 'Current Assets',
      group_name: 'Interest Receivable',
      hierarchy_level: 2
    });

    await queryInterface.bulkDelete('default_group_list', {
      name: 'Interest Receivable'
    });
  }
};
