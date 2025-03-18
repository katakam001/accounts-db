'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add transaction_id to cash_entries
    await queryInterface.addColumn('cash_entries', 'transaction_id', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });

    // Add transaction_id to journal_entries
    await queryInterface.addColumn('journal_entries', 'transaction_id', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });

    // Add narration to journal_items
    await queryInterface.addColumn('journal_items', 'narration', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove transaction_id from cash_entries
    await queryInterface.removeColumn('cash_entries', 'transaction_id');

    // Remove transaction_id from journal_entries
    await queryInterface.removeColumn('journal_entries', 'transaction_id');

    // Remove narration from journal_items
    await queryInterface.removeColumn('journal_items', 'narration');
  },
};
