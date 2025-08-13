'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Insert into default_fields
    await queryInterface.bulkInsert('default_fields', [
      { field_name: 'IGST 12%' },
      { field_name: 'IGST 18%' }
    ]);

    // Insert into default_account_list
    await queryInterface.bulkInsert('default_account_list', [
      { name: '5% IGST', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: '12% IGST', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 },
      { name: '18% IGST', credit_balance: 0.0, debit_balance: 0.0, isDealer: false, type: 4 }
    ]);

    // Insert into default_account_group
    await queryInterface.bulkInsert('default_account_group', [
      { account_name: '5% IGST', group_name: 'IGST' },
      { account_name: '12% IGST', group_name: 'IGST' },
      { account_name: '18% IGST', group_name: 'IGST' }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Delete from default_fields
    await queryInterface.bulkDelete('default_fields', {
      field_name: {
        [Sequelize.Op.in]: ['IGST 12%', 'IGST 18%']
      }
    });

    // Delete from default_account_list
    await queryInterface.bulkDelete('default_account_list', {
      name: {
        [Sequelize.Op.in]: ['5% IGST', '12% IGST', '18% IGST']
      }
    });

    // Delete from default_account_group
    await queryInterface.bulkDelete('default_account_group', {
      account_name: {
        [Sequelize.Op.in]: ['5% IGST', '12% IGST', '18% IGST']
      }
    });
  }
};
