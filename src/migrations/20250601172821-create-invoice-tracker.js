'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(sequelize, Sequelize) {
    await sequelize.createTable('invoice_tracker', {
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
      type: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        comment: 'Must be an integer (1 to 6, max 10 in future)',
      },
      last_sno: {
        type: Sequelize.INTEGER,
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
    await queryInterface.dropTable('invoice_tracker');
  }
};
