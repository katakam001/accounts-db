'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(sequelize, Sequelize) {
    // Create uploaded_file_log table
    await sequelize.createTable('uploaded_file_log', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true, //  Prevents duplicate uploads
      },
      transaction_id: {
        type: Sequelize.STRING(50),
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
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop the `uploaded_file_log` table
    await queryInterface.dropTable('uploaded_file_log');
  },
};
