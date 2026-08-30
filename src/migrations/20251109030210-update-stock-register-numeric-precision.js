'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await Promise.all([
      queryInterface.changeColumn('stock_register', 'opening_balance', {
        type: Sequelize.NUMERIC(14, 4),
        allowNull: false,
      }),
      queryInterface.changeColumn('stock_register', 'quantity', {
        type: Sequelize.NUMERIC(14, 4),
        allowNull: false,
      }),
      queryInterface.changeColumn('stock_register', 'closing_balance', {
        type: Sequelize.NUMERIC(14, 4),
        allowNull: false,
      }),
      queryInterface.changeColumn('stock_register', 'dispatch_to_process', {
        type: Sequelize.NUMERIC(14, 4),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.changeColumn('stock_register', 'received_from_process', {
        type: Sequelize.NUMERIC(14, 4),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.changeColumn('stock_register', 'purchase', {
        type: Sequelize.NUMERIC(14, 4),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.changeColumn('stock_register', 'sales', {
        type: Sequelize.NUMERIC(14, 4),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.changeColumn('stock_register', 'sale_return', {
        type: Sequelize.NUMERIC(14, 4),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.changeColumn('stock_register', 'purchase_return', {
        type: Sequelize.NUMERIC(14, 4),
        allowNull: false,
        defaultValue: 0,
      }),
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await Promise.all([
      queryInterface.changeColumn('stock_register', 'opening_balance', {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
      }),
      queryInterface.changeColumn('stock_register', 'quantity', {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
      }),
      queryInterface.changeColumn('stock_register', 'closing_balance', {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
      }),
      queryInterface.changeColumn('stock_register', 'dispatch_to_process', {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.changeColumn('stock_register', 'received_from_process', {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.changeColumn('stock_register', 'purchase', {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.changeColumn('stock_register', 'sales', {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.changeColumn('stock_register', 'sale_return', {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.changeColumn('stock_register', 'purchase_return', {
        type: Sequelize.NUMERIC(10, 4),
        allowNull: false,
        defaultValue: 0,
      }),
    ]);
  }
};
