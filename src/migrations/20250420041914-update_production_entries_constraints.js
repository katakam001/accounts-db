'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove existing foreign key constraints
    await queryInterface.removeConstraint('production_entries', 'production_entries_conversion_id_fkey');
    await queryInterface.removeConstraint('production_entries', 'production_entries_item_id_fkey');
    await queryInterface.removeConstraint('production_entries', 'production_entries_production_entry_id_fkey');
    await queryInterface.removeConstraint('production_entries', 'production_entries_raw_item_id_fkey');
    await queryInterface.removeConstraint('production_entries', 'production_entries_unit_id_fkey');

    // Add updated foreign key constraint for conversion_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('production_entries', {
      fields: ['conversion_id'],
      type: 'foreign key',
      name: 'production_entries_conversion_id_fkey',
      references: {
        table: 'conversions',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    // Add updated foreign key constraint for item_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('production_entries', {
      fields: ['item_id'],
      type: 'foreign key',
      name: 'production_entries_item_id_fkey',
      references: {
        table: 'items',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    // Add updated foreign key constraint for production_entry_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('production_entries', {
      fields: ['production_entry_id'],
      type: 'foreign key',
      name: 'production_entries_production_entry_id_fkey',
      references: {
        table: 'production_entries',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    // Add updated foreign key constraint for raw_item_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('production_entries', {
      fields: ['raw_item_id'],
      type: 'foreign key',
      name: 'production_entries_raw_item_id_fkey',
      references: {
        table: 'items',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    // Add updated foreign key constraint for unit_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('production_entries', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'production_entries_unit_id_fkey',
      references: {
        table: 'units',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove updated foreign key constraints
    await queryInterface.removeConstraint('production_entries', 'production_entries_conversion_id_fkey');
    await queryInterface.removeConstraint('production_entries', 'production_entries_item_id_fkey');
    await queryInterface.removeConstraint('production_entries', 'production_entries_production_entry_id_fkey');
    await queryInterface.removeConstraint('production_entries', 'production_entries_raw_item_id_fkey');
    await queryInterface.removeConstraint('production_entries', 'production_entries_unit_id_fkey');

    // Restore original foreign key constraint for conversion_id with ON DELETE CASCADE
    await queryInterface.addConstraint('production_entries', {
      fields: ['conversion_id'],
      type: 'foreign key',
      name: 'production_entries_conversion_id_fkey',
      references: {
        table: 'conversions',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // Restore original foreign key constraint for item_id with ON DELETE CASCADE
    await queryInterface.addConstraint('production_entries', {
      fields: ['item_id'],
      type: 'foreign key',
      name: 'production_entries_item_id_fkey',
      references: {
        table: 'items',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // Restore original foreign key constraint for production_entry_id with ON DELETE CASCADE
    await queryInterface.addConstraint('production_entries', {
      fields: ['production_entry_id'],
      type: 'foreign key',
      name: 'production_entries_production_entry_id_fkey',
      references: {
        table: 'production_entries',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // Restore original foreign key constraint for raw_item_id with ON DELETE CASCADE
    await queryInterface.addConstraint('production_entries', {
      fields: ['raw_item_id'],
      type: 'foreign key',
      name: 'production_entries_raw_item_id_fkey',
      references: {
        table: 'items',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    // Restore original foreign key constraint for unit_id with ON DELETE CASCADE
    await queryInterface.addConstraint('production_entries', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'production_entries_unit_id_fkey',
      references: {
        table: 'units',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  },
};
