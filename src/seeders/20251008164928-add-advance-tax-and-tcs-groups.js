'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Insert into default_group_list
    await queryInterface.bulkInsert('default_group_list', [
      { name: 'Advance Tax & TDS', description: null, credit_balance: 0.0, debit_balance: 0.0 },
      { name: 'TCS', description: null, credit_balance: 0.0, debit_balance: 0.0 }
    ]);

    // Insert into default_fields
    await queryInterface.bulkInsert('default_fields', [
      { field_name: 'TCS 0.1%' }
    ]);

    // Insert into default_group_mapping
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('default_group_mapping', {
      [Sequelize.Op.or]: [
        { parent_name: 'Current Assets', group_name: 'Advance Tax & TDS', hierarchy_level: 2 },
        { parent_name: 'Advance Tax & TDS', group_name: 'TCS', hierarchy_level: 3 }
      ]
    });

    await queryInterface.bulkDelete('default_fields', {
      field_name: 'TCS 0.1%'
    });

    await queryInterface.bulkDelete('default_group_list', {
      name: {
        [Sequelize.Op.in]: ['Advance Tax & TDS', 'TCS']
      }
    });
  }
};
