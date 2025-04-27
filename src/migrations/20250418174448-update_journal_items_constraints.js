'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the existing foreign key constraints
    await queryInterface.removeConstraint('journal_items', 'journal_items_account_id_fkey');
    await queryInterface.removeConstraint('journal_items', 'journal_items_group_id_fkey');
    await queryInterface.removeConstraint('journal_items', 'journal_items_journal_id_fkey');

    // Add updated foreign key constraint for account_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('journal_items', {
      fields: ['account_id'],
      type: 'foreign key',
      name: 'journal_items_account_id_fkey', // Custom constraint name
      references: {
        table: 'account_list',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });

    // Add updated foreign key constraint for group_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('journal_items', {
      fields: ['group_id'],
      type: 'foreign key',
      name: 'journal_items_group_id_fkey', // Custom constraint name
      references: {
        table: 'group_list',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });

    // Add updated foreign key constraint for journal_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('journal_items', {
      fields: ['journal_id'],
      type: 'foreign key',
      name: 'journal_items_journal_id_fkey', // Custom constraint name
      references: {
        table: 'journal_entries',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the updated foreign key constraints
    await queryInterface.removeConstraint('journal_items', 'journal_items_account_id_fkey');
    await queryInterface.removeConstraint('journal_items', 'journal_items_group_id_fkey');
    await queryInterface.removeConstraint('journal_items', 'journal_items_journal_id_fkey');

    // Restore the original foreign key constraint for account_id with ON DELETE CASCADE
    await queryInterface.addConstraint('journal_items', {
      fields: ['account_id'],
      type: 'foreign key',
      name: 'journal_items_account_id_fkey', // Custom constraint name
      references: {
        table: 'account_list',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore to ON DELETE CASCADE
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });

    // Restore the original foreign key constraint for group_id with ON DELETE CASCADE
    await queryInterface.addConstraint('journal_items', {
      fields: ['group_id'],
      type: 'foreign key',
      name: 'journal_items_group_id_fkey', // Custom constraint name
      references: {
        table: 'group_list',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore to ON DELETE CASCADE
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });

    // Restore the original foreign key constraint for journal_id with ON DELETE CASCADE
    await queryInterface.addConstraint('journal_items', {
      fields: ['journal_id'],
      type: 'foreign key',
      name: 'journal_items_journal_id_fkey', // Custom constraint name
      references: {
        table: 'journal_entries',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore to ON DELETE CASCADE
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });
  },
};
