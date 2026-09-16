'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex(
      'cash_entries_batch',
      ['transaction_id', 'user_id', 'financial_year', 'is_cash_adjustment'],
      {
        name: 'cash_entries_batch_unique_txn_user_year_adjustment',
        unique: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      'cash_entries_batch',
      'cash_entries_batch_unique_txn_user_year_adjustment'
    );
  }
};
