'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ✅ cash_entries: transaction_id + user_id + financial_year + is_cash_adjustment
    await queryInterface.addIndex(
      'cash_entries',
      ['transaction_id', 'user_id', 'financial_year', 'is_cash_adjustment'],
      {
        name: 'cash_entries_txn_user_year_adjustment_idx',
        using: 'btree',
      }
    );

    // ✅ cash_entries: cash_date index
    await queryInterface.addIndex(
      'cash_entries',
      ['cash_date'],
      {
        name: 'idx_cash_entries_cash_date',
        using: 'btree',
      }
    );

    // ✅ cash_entries: user_id + financial_year
    await queryInterface.addIndex(
      'cash_entries',
      ['user_id', 'financial_year'],
      {
        name: 'idx_cash_entries_user_financial_year',
        using: 'btree',
      }
    );

    // ✅ cash_entries: user_id + financial_year + is_cash_adjustment
    await queryInterface.addIndex(
      'cash_entries',
      ['user_id', 'financial_year', 'is_cash_adjustment'],
      {
        name: 'idx_cash_entries_user_year_adjustment',
        using: 'btree',
      }
    );

    // ✅ cash_entries_batch: transaction_id + user_id + financial_year + is_cash_adjustment
    await queryInterface.addIndex(
      'cash_entries_batch',
      ['transaction_id', 'user_id', 'financial_year', 'is_cash_adjustment'],
      {
        name: 'cash_entries_batch_txn_user_year_adjustment_idx',
        using: 'btree',
      }
    );

    // ✅ cash_entries_batch: user_id + financial_year + is_cash_adjustment
    await queryInterface.addIndex(
      'cash_entries_batch',
      ['user_id', 'financial_year', 'is_cash_adjustment'],
      {
        name: 'idx_cash_entries_batch_user_year_adjustment',
        using: 'btree',
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // 🔁 Remove indexes from cash_entries
    await queryInterface.removeIndex('cash_entries', 'cash_entries_txn_user_year_adjustment_idx');
    await queryInterface.removeIndex('cash_entries', 'idx_cash_entries_cash_date');
    await queryInterface.removeIndex('cash_entries', 'idx_cash_entries_user_financial_year');
    await queryInterface.removeIndex('cash_entries', 'idx_cash_entries_user_year_adjustment');

    // 🔁 Remove indexes from cash_entries_batch
    await queryInterface.removeIndex('cash_entries_batch', 'cash_entries_batch_txn_user_year_adjustment_idx');
    await queryInterface.removeIndex('cash_entries_batch', 'idx_cash_entries_batch_user_year_adjustment');
  }
};
