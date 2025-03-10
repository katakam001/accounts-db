'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(sequelize, Sequelize) {
    // Create default_account_list table
    await sequelize.bulkInsert('default_account_group', [
      { account_name: 'SGST 2.5%', group_name: 'SGST' },
      { account_name: 'CGST 2.5%', group_name: 'CGST' },
      { account_name: 'SGST 6%', group_name: 'SGST' },
      { account_name: 'CGST 6%', group_name: 'CGST' },
      { account_name: 'SGST 9%', group_name: 'SGST' },
      { account_name: 'CGST 9%', group_name: 'CGST' },
    ]);
  },

  down: async (sequelize, Sequelize) => {
    // Drop tables in reverse order
    await sequelize.bulkDelete('default_account_group', null, {});
  }
};
