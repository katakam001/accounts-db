'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(sequelize, Sequelize) {
    // Create cash_entries_batch table
    await sequelize.createTable('cash_entries_batch', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      cash_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      narration: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'account_list', // Ensure this matches the `account_list` table name
          key: 'id',
        },
      },
      type: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      transaction_id: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'group_list', // Ensure this matches the `group_list` table name
          key: 'id',
        },
        onDelete: 'CASCADE', // Ensure cascading deletes for group_list
      },
    });

  },

  async down(queryInterface, Sequelize) {

    // Drop the `cash_entries_batch` table
    await queryInterface.dropTable('cash_entries_batch');
  },
};
