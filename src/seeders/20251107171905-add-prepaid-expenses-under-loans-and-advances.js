'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('default_group_mapping', [
      {
        parent_name: 'Loans and Advances',
        group_name: 'Prepaid Expenses',
        hierarchy_level: 3
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('default_group_mapping', {
      parent_name: 'Loans and Advances',
      group_name: 'Prepaid Expenses'
    });
  }
};
