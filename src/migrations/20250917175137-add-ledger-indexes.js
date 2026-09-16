'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // journal_items indexes
    await queryInterface.addIndex('journal_items', ['account_id'], {
      name: 'idx_journal_items_account_id',
    });
    await queryInterface.addIndex('journal_items', ['journal_id'], {
      name: 'idx_journal_items_journal_id',
    });
    await queryInterface.addIndex('journal_items', ['group_id'], {
      name: 'idx_journal_items_group_id',
    });

    // journal_entries composite index
    await queryInterface.addIndex('journal_entries', ['user_id', 'financial_year', 'journal_date'], {
      name: 'idx_journal_entries_user_year_date',
    });

    // group_list index
    await queryInterface.addIndex('group_list', ['user_id', 'financial_year'], {
      name: 'idx_group_list_user_year',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('journal_items', 'idx_journal_items_account_id');
    await queryInterface.removeIndex('journal_items', 'idx_journal_items_journal_id');
    await queryInterface.removeIndex('journal_items', 'idx_journal_items_group_id');
    await queryInterface.removeIndex('journal_entries', 'idx_journal_entries_user_year_date');
    await queryInterface.removeIndex('group_list', 'idx_group_list_user_year');
  }
};
