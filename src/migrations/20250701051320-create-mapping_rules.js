'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(sequelize, Sequelize) {
    await sequelize.createTable('mapping_rules', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      source: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      target: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      type: {
        type: Sequelize.INTEGER,
        allowNull: false, // 0 = Group, 1 = Account
      },
      statement_type: {
        type: Sequelize.INTEGER,
        allowNull: false, // 0 = Trail Balance, 1 = Bank Statement, 2 = Credit Card Statement
      },
      statement_provider: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      amount_mandatory: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('mapping_rules');
  },
};
