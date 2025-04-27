'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop existing foreign key constraints
    await queryInterface.removeConstraint('entries', 'entries_account_id_fkey');
    await queryInterface.removeConstraint('entries', 'entries_category_id_fkey');
    await queryInterface.removeConstraint('entries', 'entries_item_id_fkey');
    await queryInterface.removeConstraint('entries', 'entries_journal_id_fkey');
    await queryInterface.removeConstraint('entries', 'entries_unit_id_fkey');
    await queryInterface.removeConstraint('entries', 'entries_category_account_id_fkey');

    // Add updated foreign key constraints with ON DELETE RESTRICT
    await queryInterface.addConstraint('entries', {
      fields: ['account_id'],
      type: 'foreign key',
      name: 'entries_account_id_fkey', // Custom constraint name
      references: {
        table: 'account_list',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('entries', {
      fields: ['category_id'],
      type: 'foreign key',
      name: 'entries_category_id_fkey', // Custom constraint name
      references: {
        table: 'categories',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('entries', {
      fields: ['item_id'],
      type: 'foreign key',
      name: 'entries_item_id_fkey', // Custom constraint name
      references: {
        table: 'items',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('entries', {
      fields: ['journal_id'],
      type: 'foreign key',
      name: 'entries_journal_id_fkey', // Custom constraint name
      references: {
        table: 'journal_entries',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('entries', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'entries_unit_id_fkey', // Custom constraint name
      references: {
        table: 'units',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    // Add the new category_account_id constraint
    await queryInterface.addConstraint('entries', {
      fields: ['category_account_id'],
      type: 'foreign key',
      name: 'entries_category_account_id_fkey', // Custom constraint name
      references: {
        table: 'account_list',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove updated foreign key constraints
    await queryInterface.removeConstraint('entries', 'entries_account_id_fkey');
    await queryInterface.removeConstraint('entries', 'entries_category_id_fkey');
    await queryInterface.removeConstraint('entries', 'entries_item_id_fkey');
    await queryInterface.removeConstraint('entries', 'entries_journal_id_fkey');
    await queryInterface.removeConstraint('entries', 'entries_unit_id_fkey');
    await queryInterface.removeConstraint('entries', 'entries_category_account_id_fkey');

    // Restore original foreign key constraints (if needed)
    await queryInterface.addConstraint('entries', {
      fields: ['account_id'],
      type: 'foreign key',
      name: 'entries_account_id_fkey', // Custom constraint name
      references: {
        table: 'account_list',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('entries', {
      fields: ['category_id'],
      type: 'foreign key',
      name: 'entries_category_id_fkey', // Custom constraint name
      references: {
        table: 'categories',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('entries', {
      fields: ['item_id'],
      type: 'foreign key',
      name: 'entries_item_id_fkey', // Custom constraint name
      references: {
        table: 'items',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('entries', {
      fields: ['journal_id'],
      type: 'foreign key',
      name: 'entries_journal_id_fkey', // Custom constraint name
      references: {
        table: 'journal_entries',
        field: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addConstraint('entries', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'entries_unit_id_fkey', // Custom constraint name
      references: {
        table: 'units',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

  },
};
