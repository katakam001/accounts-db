'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add a unique index to the account_list table
    await queryInterface.addIndex('account_list', {
      fields: ['user_id', 'financial_year', Sequelize.fn('LOWER', Sequelize.col('name'))],
      name: 'unique_account_per_user_year',
      unique: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the unique index from the account_list table
    await queryInterface.removeIndex('account_list', 'unique_account_per_user_year');
  }
};
