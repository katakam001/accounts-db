'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the existing foreign key constraints
    await queryInterface.removeConstraint('entry_fields', 'entry_fields_entry_id_fkey');
    await queryInterface.removeConstraint('entry_fields', 'entry_fields_field_id_fkey');

    // Add new foreign key constraint for entry_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('entry_fields', {
      fields: ['entry_id'],
      type: 'foreign key',
      name: 'entry_fields_entry_id_fkey',
      references: {
        table: 'entries',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });

    // Add new foreign key constraint for field_id with ON DELETE RESTRICT
    await queryInterface.addConstraint('entry_fields', {
      fields: ['field_id'],
      type: 'foreign key',
      name: 'entry_fields_field_id_fkey',
      references: {
        table: 'fields',
        field: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove updated foreign key constraints
    await queryInterface.removeConstraint('entry_fields', 'entry_fields_entry_id_fkey');
    await queryInterface.removeConstraint('entry_fields', 'entry_fields_field_id_fkey');

    // Restore original foreign key constraint for entry_id with ON DELETE CASCADE
    await queryInterface.addConstraint('entry_fields', {
      fields: ['entry_id'],
      type: 'foreign key',
      name: 'entry_fields_entry_id_fkey',
      references: {
        table: 'entries',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore to ON DELETE CASCADE
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });

    // Restore original foreign key constraint for field_id with ON DELETE CASCADE
    await queryInterface.addConstraint('entry_fields', {
      fields: ['field_id'],
      type: 'foreign key',
      name: 'entry_fields_field_id_fkey',
      references: {
        table: 'fields',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore to ON DELETE CASCADE
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });
  },
};
