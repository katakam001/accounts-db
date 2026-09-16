'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Delete old incorrect mappings
    await queryInterface.bulkDelete('default_group_mapping', {
      parent_name: 'Current Assets',
      group_name: 'Advance Tax & TDS'
    });

    await queryInterface.bulkDelete('default_group_mapping', {
      parent_name: 'Advance Tax & TDS',
      group_name: 'TCS'
    });

    // Insert corrected hierarchy
    await queryInterface.bulkInsert('default_group_mapping', [
      {
        parent_name: 'Loans and Advances',
        group_name: 'Advance Tax & TDS',
        hierarchy_level: 3
      },
      {
        parent_name: 'Advance Tax & TDS',
        group_name: 'TCS',
        hierarchy_level: 4
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Revert to original mappings
    await queryInterface.bulkDelete('default_group_mapping', {
      parent_name: 'Loans and Advances',
      group_name: 'Advance Tax & TDS'
    });

    await queryInterface.bulkDelete('default_group_mapping', {
      parent_name: 'Advance Tax & TDS',
      group_name: 'TCS'
    });

    await queryInterface.bulkInsert('default_group_mapping', [
      {
        parent_name: 'Current Assets',
        group_name: 'Advance Tax & TDS',
        hierarchy_level: 2
      },
      {
        parent_name: 'Advance Tax & TDS',
        group_name: 'TCS',
        hierarchy_level: 3
      }
    ]);
  }
};
