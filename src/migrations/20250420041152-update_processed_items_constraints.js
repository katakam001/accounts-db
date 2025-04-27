'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the existing foreign key constraints
    await queryInterface.removeConstraint('processed_items', 'processed_items_conversion_id_fkey');
    await queryInterface.removeConstraint('processed_items', 'processed_items_item_id_fkey');
    await queryInterface.removeConstraint('processed_items', 'processed_items_raw_item_id_fkey');
    await queryInterface.removeConstraint('processed_items', 'processed_items_unit_id_fkey');

    // Add new foreign key constraint for conversion_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('processed_items', {
      fields: ['conversion_id'],
      type: 'foreign key',
      name: 'processed_items_conversion_id_fkey', // Custom constraint name
      references: {
        table: 'conversions',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });

    // Add new foreign key constraint for item_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('processed_items', {
      fields: ['item_id'],
      type: 'foreign key',
      name: 'processed_items_item_id_fkey', // Custom constraint name
      references: {
        table: 'items',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });

    // Add new foreign key constraint for raw_item_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('processed_items', {
      fields: ['raw_item_id'],
      type: 'foreign key',
      name: 'processed_items_raw_item_id_fkey', // Custom constraint name
      references: {
        table: 'raw_items',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });

    // Add new foreign key constraint for unit_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('processed_items', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'processed_items_unit_id_fkey', // Custom constraint name
      references: {
        table: 'units',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the updated foreign key constraints
    await queryInterface.removeConstraint('processed_items', 'processed_items_conversion_id_fkey');
    await queryInterface.removeConstraint('processed_items', 'processed_items_item_id_fkey');
    await queryInterface.removeConstraint('processed_items', 'processed_items_raw_item_id_fkey');
    await queryInterface.removeConstraint('processed_items', 'processed_items_unit_id_fkey');

    // Restore the original foreign key constraint for conversion_id with ON DELETE CASCADE
    await queryInterface.addConstraint('processed_items', {
      fields: ['conversion_id'],
      type: 'foreign key',
      name: 'processed_items_conversion_id_fkey', // Custom constraint name
      references: {
        table: 'conversions',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore ON DELETE CASCADE
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });

    // Restore the original foreign key constraint for item_id with ON DELETE CASCADE
    await queryInterface.addConstraint('processed_items', {
      fields: ['item_id'],
      type: 'foreign key',
      name: 'processed_items_item_id_fkey', // Custom constraint name
      references: {
        table: 'items',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore ON DELETE CASCADE
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });

    // Restore the original foreign key constraint for raw_item_id with ON DELETE CASCADE
    await queryInterface.addConstraint('processed_items', {
      fields: ['raw_item_id'],
      type: 'foreign key',
      name: 'processed_items_raw_item_id_fkey', // Custom constraint name
      references: {
        table: 'raw_items',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore ON DELETE CASCADE
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });

    // Restore the original foreign key constraint for unit_id with ON DELETE CASCADE
    await queryInterface.addConstraint('processed_items', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'processed_items_unit_id_fkey', // Custom constraint name
      references: {
        table: 'units',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore ON DELETE CASCADE
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });
  },
};
