'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('daily_cash_entry_summary', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      entry_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('daily_cash_entry_summary', {
      fields: ['entry_date', 'account_id'],
      type: 'unique',
      name: 'unique_entry_date_account_id'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('daily_cash_entry_summary');
  }
};
