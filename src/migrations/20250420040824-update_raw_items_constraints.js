'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the existing foreign key constraints
    await queryInterface.removeConstraint('raw_items', 'raw_items_item_id_fkey');
    await queryInterface.removeConstraint('raw_items', 'raw_items_unit_id_fkey');

    // Add new foreign key constraint for item_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('raw_items', {
      fields: ['item_id'],
      type: 'foreign key',
      name: 'raw_items_item_id_fkey', // Custom constraint name
      references: {
        table: 'items',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Retain ON UPDATE CASCADE
    });

    // Add new foreign key constraint for unit_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('raw_items', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'raw_items_unit_id_fkey', // Custom constraint name
      references: {
        table: 'units',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Retain ON UPDATE CASCADE
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the updated foreign key constraints
    await queryInterface.removeConstraint('raw_items', 'raw_items_item_id_fkey');
    await queryInterface.removeConstraint('raw_items', 'raw_items_unit_id_fkey');

    // Restore the original foreign key constraint for item_id with ON DELETE CASCADE
    await queryInterface.addConstraint('raw_items', {
      fields: ['item_id'],
      type: 'foreign key',
      name: 'raw_items_item_id_fkey', // Custom constraint name
      references: {
        table: 'items',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore to ON DELETE CASCADE
      onUpdate: 'CASCADE',  // Retain ON UPDATE CASCADE
    });

    // Restore the original foreign key constraint for unit_id with ON DELETE CASCADE
    await queryInterface.addConstraint('raw_items', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'raw_items_unit_id_fkey', // Custom constraint name
      references: {
        table: 'units',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore to ON DELETE CASCADE
      onUpdate: 'CASCADE',  // Retain ON UPDATE CASCADE
    });
  },
};
