'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface, Sequelize) {
    //  Delete specific mappings
    await queryInterface.bulkDelete('default_account_group', {
      [Sequelize.Op.or]: [
        { account_name: 'Purchase Account', group_name: 'Trading Account' },
        { account_name: 'Sales Account', group_name: 'Trading Account' }
      ]
    });
  },

  async down(queryInterface, Sequelize) {
    //  Restore deleted mappings
    await queryInterface.bulkInsert('default_account_group', [
      { account_name: 'Purchase Account', group_name: 'Trading Account' },
      { account_name: 'Sales Account', group_name: 'Trading Account' }
    ]);
  }
};
