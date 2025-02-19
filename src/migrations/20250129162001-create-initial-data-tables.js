'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(sequelize, Sequelize) {
    // Create default_account_list table
    await sequelize.createTable('default_account_list', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      credit_balance: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      debit_balance: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      isDealer: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      type: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
    });

    // Create default_group_list table
    await sequelize.createTable('default_group_list', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      credit_balance: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      debit_balance: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
    });

    // Create default_fields table
    await sequelize.createTable('default_fields', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      field_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
    });

    // Create default_account_group table
    await sequelize.createTable('default_account_group', {
      account_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        primaryKey: true,
      },
      group_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        primaryKey: true,
      },
    });
  },

  down: async (sequelize, Sequelize) => {
    // Drop tables in reverse order
    await sequelize.dropTable('default_account_group');
    await sequelize.dropTable('default_fields');
    await sequelize.dropTable('default_group_list');
    await sequelize.dropTable('default_account_list');
  }
};
