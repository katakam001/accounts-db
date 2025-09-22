'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cash_entry_fields', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      cash_sale_entry_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      field_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      field_value: {
        type: Sequelize.TEXT,
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

    await queryInterface.addConstraint('cash_entry_fields', {
      fields: ['cash_sale_entry_id'],
      type: 'foreign key',
      name: 'cash_entry_fields_cash_sale_entry_id_fkey',
      references: {
        table: 'cash_sale_entries',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('cash_entry_fields', {
      fields: ['field_id'],
      type: 'foreign key',
      name: 'cash_entry_fields_field_id_fkey',
      references: {
        table: 'fields',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('cash_entry_fields');
  }
};
