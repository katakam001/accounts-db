'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 📌 account_list: filter by user_id and financial_year
    await queryInterface.addIndex('account_list', ['user_id', 'financial_year'], {
      name: 'idx_account_list_user_year',
    });

    // 📌 journal_items: filter by account_id and join on journal_id
    await queryInterface.addIndex('journal_items', ['account_id', 'journal_id'], {
      name: 'idx_journal_items_account_journal',
    });

    // 📌 cash_entries: composite filter for account copy
    await queryInterface.addIndex('cash_entries', ['user_id', 'financial_year', 'account_id', 'cash_date'], {
      name: 'idx_cash_entries_user_year_account_date',
    });

    // 📌 cash_entries_batch: same composite filter
    await queryInterface.addIndex('cash_entries_batch', ['user_id', 'financial_year', 'account_id', 'cash_date'], {
      name: 'idx_cash_entries_batch_user_year_account_date',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('account_list', 'idx_account_list_user_year');
    await queryInterface.removeIndex('journal_items', 'idx_journal_items_account_journal');
    await queryInterface.removeIndex('cash_entries', 'idx_cash_entries_user_year_account_date');
    await queryInterface.removeIndex('cash_entries_batch', 'idx_cash_entries_batch_user_year_account_date');
  }
};
