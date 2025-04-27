'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the existing foreign key constraints
    await queryInterface.removeConstraint('fields_mapping', 'fields_mapping_category_id_fkey');
    await queryInterface.removeConstraint('fields_mapping', 'fields_mapping_field_id_fkey');
    await queryInterface.removeConstraint('fields_mapping', 'fields_mapping_account_id_fkey');

    // Add new foreign key constraint for category_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('fields_mapping', {
      fields: ['category_id'],
      type: 'foreign key',
      name: 'fields_mapping_category_id_fkey', // Custom constraint name
      references: {
        table: 'categories',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });

    // Add new foreign key constraint for field_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('fields_mapping', {
      fields: ['field_id'],
      type: 'foreign key',
      name: 'fields_mapping_field_id_fkey', // Custom constraint name
      references: {
        table: 'fields',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });

    // Add new foreign key constraint for account_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('fields_mapping', {
      fields: ['account_id'],
      type: 'foreign key',
      name: 'fields_mapping_account_id_fkey', // Custom constraint name
      references: {
        table: 'account_list',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the updated foreign key constraints
    await queryInterface.removeConstraint('fields_mapping', 'fields_mapping_category_id_fkey');
    await queryInterface.removeConstraint('fields_mapping', 'fields_mapping_field_id_fkey');
    await queryInterface.removeConstraint('fields_mapping', 'fields_mapping_account_id_fkey');

    // Restore the original foreign key constraint for category_id with ON DELETE CASCADE
    await queryInterface.addConstraint('fields_mapping', {
      fields: ['category_id'],
      type: 'foreign key',
      name: 'fields_mapping_category_id_fkey', // Custom constraint name
      references: {
        table: 'categories',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore ON DELETE CASCADE
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });

    // Restore the original foreign key constraint for field_id with ON DELETE CASCADE
    await queryInterface.addConstraint('fields_mapping', {
      fields: ['field_id'],
      type: 'foreign key',
      name: 'fields_mapping_field_id_fkey', // Custom constraint name
      references: {
        table: 'fields',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore ON DELETE CASCADE
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    });

  },
};
