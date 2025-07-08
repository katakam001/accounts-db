'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add a unique index to the account_list table
    await queryInterface.addIndex('mapping_rules', ['statement_type', 'statement_provider'], {
      name: 'mapping_rules_statement_type_provider_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the unique index from the account_list table
    await queryInterface.removeIndex('mapping_rules', 'mapping_rules_statement_type_provider_idx');
  }
};
