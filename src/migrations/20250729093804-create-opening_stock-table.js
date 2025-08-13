'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(sequelize, Sequelize) {
    await sequelize.createTable('opening_stock', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'items',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
      },
      rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
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
    await queryInterface.dropTable('opening_stock');
  },
};
