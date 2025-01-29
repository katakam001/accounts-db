'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('balance', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
    });
    await queryInterface.createTable('consolidated_stock_register', {
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      total_purchase: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_sales: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_sale_return: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_purchase_return: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_quantity: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_closing_balance: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_dispatch_to_process: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_received_from_process: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false,
        primaryKey: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('consolidated_stock_register');
    await queryInterface.dropTable('balance');

  }
};
