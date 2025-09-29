'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Unique index for cash_entries
    await queryInterface.addIndex('cash_entries', {
      name: 'cash_entries_unique_txn_user_year_adjustment',
      unique: true,
      fields: ['transaction_id', 'user_id', 'financial_year', 'is_cash_adjustment']
    });

    // Unique index for cash_entries_batch
    await queryInterface.addIndex('cash_entries_batch', {
      name: 'cash_entries_batch_unique_txn_user_year_adjustment',
      unique: true,
      fields: ['transaction_id', 'user_id', 'financial_year', 'is_cash_adjustment']
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('cash_entries', 'cash_entries_unique_txn_user_year_adjustment');
    await queryInterface.removeIndex('cash_entries_batch', 'cash_entries_batch_unique_txn_user_year_adjustment');
  }
};
