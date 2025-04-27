'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the existing foreign key constraints
    await queryInterface.removeConstraint('category_units', 'category_units_category_id_fkey');
    await queryInterface.removeConstraint('category_units', 'category_units_unit_id_fkey');

    // Add new foreign key constraint for category_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('category_units', {
      fields: ['category_id'],
      type: 'foreign key',
      name: 'category_units_category_id_fkey', // Custom constraint name
      references: {
        table: 'categories',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Retain ON UPDATE CASCADE
    });

    // Add new foreign key constraint for unit_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('category_units', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'category_units_unit_id_fkey', // Custom constraint name
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
    await queryInterface.removeConstraint('category_units', 'category_units_category_id_fkey');
    await queryInterface.removeConstraint('category_units', 'category_units_unit_id_fkey');

    // Restore the original foreign key constraint for category_id with ON DELETE CASCADE
    await queryInterface.addConstraint('category_units', {
      fields: ['category_id'],
      type: 'foreign key',
      name: 'category_units_category_id_fkey', // Custom constraint name
      references: {
        table: 'categories',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore to ON DELETE CASCADE
      onUpdate: 'CASCADE',  // Retain ON UPDATE CASCADE
    });

    // Restore the original foreign key constraint for unit_id with ON DELETE CASCADE
    await queryInterface.addConstraint('category_units', {
      fields: ['unit_id'],
      type: 'foreign key',
      name: 'category_units_unit_id_fkey', // Custom constraint name
      references: {
        table: 'units',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore to ON DELETE CASCADE
      onUpdate: 'CASCADE',  // Retain ON UPDATE CASCADE
    });
  },
};
