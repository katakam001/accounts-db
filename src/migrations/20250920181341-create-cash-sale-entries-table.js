'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('cash_sale_entries', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      entry_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 4)
      },
      unit_price: {
        type: Sequelize.DECIMAL(10, 2)
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2)
      },
      value: {
        type: Sequelize.DECIMAL(15, 2)
      },
      user_id: {
        type: Sequelize.INTEGER
      },
      financial_year: {
        type: Sequelize.STRING,
        allowNull: false
      },
      unit_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      type: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 8
      },
      invoiceNumber: {
        type: Sequelize.STRING
      },
      category_account_id: {
        type: Sequelize.INTEGER
      },
      invoice_seq_id: {
        type: Sequelize.BIGINT
      },
      sNo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
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

    await queryInterface.addConstraint('cash_sale_entries', {
      fields: ['category_account_id'],
      type: 'foreign key',
      name: 'cash_sale_entries_category_account_id_fkey',
      references: {
        table: 'account_list',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('cash_sale_entries', {
      fields: ['category_id'],
      type: 'foreign key',
      name: 'cash_sale_entries_category_id_fkey',
      references: {
        table: 'categories',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });
    await queryInterface.addConstraint('cash_sale_entries', {
      fields: ['account_id'],
      type: 'foreign key',
      name: 'cash_sale_entries_account_id_fkey',
      references: {
        table: 'account_list',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('cash_sale_entries', {
      fields: ['item_id'],
      type: 'foreign key',
      name: 'cash_sale_entries_item_id_fkey',
      references: {
        table: 'items',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('cash_sale_entries', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'cash_sale_entries_unit_id_fkey',
      references: {
        table: 'units',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('cash_sale_entries');
  }
};
