'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cash_sale_entry_links', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      cash_sale_entry_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      summary_id: {
        type: Sequelize.INTEGER,
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

    await queryInterface.addConstraint('cash_sale_entry_links', {
      fields: ['cash_sale_entry_id'],
      type: 'foreign key',
      name: 'fk_cash_sale_entry_links_entry',
      references: {
        table: 'cash_sale_entries',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('cash_sale_entry_links', {
      fields: ['summary_id'],
      type: 'foreign key',
      name: 'fk_cash_sale_entry_links_summary',
      references: {
        table: 'daily_cash_entry_summary',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('cash_sale_entry_links', {
      fields: ['cash_sale_entry_id', 'summary_id'],
      type: 'unique',
      name: 'unique_cash_sale_entry_summary_link'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('cash_sale_entry_links');
  }
};
