'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    
    // For balance table
    await queryInterface.changeColumn('balance', 'amount', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    });

    // For account_list table
    await queryInterface.changeColumn('account_list', 'credit_balance', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    });
    await queryInterface.changeColumn('account_list', 'debit_balance', {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    });

    // For group_list table
    await queryInterface.changeColumn('group_list', 'credit_balance', {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    });
    await queryInterface.changeColumn('group_list', 'debit_balance', {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    });

    // For cash_entries table
    await queryInterface.changeColumn('cash_entries', 'amount', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    });

    // For journal_items table
    await queryInterface.changeColumn('journal_items', 'amount', {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    });

    // For entries table
    await queryInterface.changeColumn('entries', 'quantity', {
      type: Sequelize.DECIMAL(10, 4),
      allowNull: true,
    });
    await queryInterface.changeColumn('entries', 'unit_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.changeColumn('entries', 'total_amount', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
    await queryInterface.changeColumn('entries', 'value', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Reverting changes for balance table
    await queryInterface.changeColumn('balance', 'amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    });

    // Reverting changes for account_list table
    await queryInterface.changeColumn('account_list', 'credit_balance', {
      type: Sequelize.FLOAT,
      allowNull: false,
    });
    await queryInterface.changeColumn('account_list', 'debit_balance', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      allowNull: false,
    });

    // Reverting changes for group_list table
    await queryInterface.changeColumn('group_list', 'credit_balance', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      allowNull: false,
    });
    await queryInterface.changeColumn('group_list', 'debit_balance', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      allowNull: false,
    });

    // Reverting changes for cash_entries table
    await queryInterface.changeColumn('cash_entries', 'amount', {
      type: Sequelize.FLOAT,
      allowNull: false,
    });

    // Reverting changes for journal_items table
    await queryInterface.changeColumn('journal_items', 'amount', {
      type: Sequelize.FLOAT,
      defaultValue: 0,
      allowNull: false,
    });

    // Reverting changes for entries table
    await queryInterface.changeColumn('entries', 'quantity', {
      type: Sequelize.NUMERIC,
      allowNull: true,
    });
    await queryInterface.changeColumn('entries', 'unit_price', {
      type: Sequelize.NUMERIC,
      allowNull: true,
    });
    await queryInterface.changeColumn('entries', 'total_amount', {
      type: Sequelize.NUMERIC,
      allowNull: true,
    });
    await queryInterface.changeColumn('entries', 'value', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },
};
