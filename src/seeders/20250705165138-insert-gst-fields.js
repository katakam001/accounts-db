'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('default_fields', [
      { field_name: 'CGST 9%' },
      { field_name: 'SGST 9%' },
      { field_name: 'CGST 6%' },
      { field_name: 'SGST 6%' }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('default_fields', {
      field_name: {
        [Sequelize.Op.in]: [
          'CGST 9%',
          'SGST 9%',
          'CGST 6%',
          'SGST 6%'
        ]
      }
    });
  }
};
