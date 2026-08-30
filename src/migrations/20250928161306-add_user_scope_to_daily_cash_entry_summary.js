'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('daily_cash_entry_summary', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    await queryInterface.addColumn('daily_cash_entry_summary', 'financial_year', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // Drop old unique constraint
    await queryInterface.removeConstraint('daily_cash_entry_summary', 'unique_entry_date_account_id');

    // Add new unique index
    await queryInterface.addConstraint('daily_cash_entry_summary', {
      fields: ['entry_date', 'account_id', 'user_id', 'financial_year'],
      type: 'unique',
      name: 'unique_summary_entry_account_user_year'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint('daily_cash_entry_summary', 'unique_summary_entry_account_user_year');

    await queryInterface.removeColumn('daily_cash_entry_summary', 'user_id');
    await queryInterface.removeColumn('daily_cash_entry_summary', 'financial_year');

    await queryInterface.addConstraint('daily_cash_entry_summary', {
      fields: ['entry_date', 'account_id'],
      type: 'unique',
      name: 'unique_entry_date_account_id'
    });
  }
};
