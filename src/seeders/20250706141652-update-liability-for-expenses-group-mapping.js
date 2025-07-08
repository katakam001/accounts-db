'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ❌ Delete the incorrect mapping
    await queryInterface.bulkDelete('default_group_mapping', {
      parent_name: 'Liability For Expense',
      group_name: 'Provisions',
      hierarchy_level: 3
    });

    // ❌ Remove incorrect group mapping
    await queryInterface.bulkDelete('default_group_mapping', {
      parent_name: 'Current Liabilities',
      group_name: 'Liability For Expense',
      hierarchy_level: 2
    });

    // ✅ Insert the corrected mapping
    await queryInterface.bulkInsert('default_group_mapping', [
      {
        parent_name: 'Liability For Expenses',
        group_name: 'Provisions',
        hierarchy_level: 3
      }
    ]);

    // ✅ Insert corrected group mapping
    await queryInterface.bulkInsert('default_group_mapping', [
      {
        parent_name: 'Current Liabilities',
        group_name: 'Liability For Expenses',
        hierarchy_level: 2
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // 🔁 Rollback: delete corrected and restore original
    await queryInterface.bulkDelete('default_group_mapping', {
      parent_name: 'Liability For Expenses',
      group_name: 'Provisions',
      hierarchy_level: 3
    });

    await queryInterface.bulkDelete('default_group_mapping', {
      parent_name: 'Current Liabilities',
      group_name: 'Liability For Expenses',
      hierarchy_level: 2
    });

    await queryInterface.bulkInsert('default_group_mapping', [
      {
        parent_name: 'Liability For Expense',
        group_name: 'Provisions',
        hierarchy_level: 3
      }
    ]);

    await queryInterface.bulkInsert('default_group_mapping', [
      {
        parent_name: 'Current Liabilities',
        group_name: 'Liability For Expense',
        hierarchy_level: 2
      }
    ]);
  }
};
