'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the existing foreign key constraint for group_id
    await queryInterface.removeConstraint('cash_entries_batch', 'cash_entries_batch_group_id_fkey');

    // Add a new foreign key constraint for group_id without ON DELETE CASCADE (default to ON DELETE RESTRICT)
    await queryInterface.addConstraint('cash_entries_batch', {
      fields: ['group_id'],
      type: 'foreign key',
      name: 'cash_entries_batch_group_id_fkey', // Custom constraint name
      references: {
        table: 'group_list',
        field: 'id',
      },
      onUpdate: 'CASCADE', // Optional: Retains ON UPDATE CASCADE for consistency
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the updated foreign key constraint for group_id
    await queryInterface.removeConstraint('cash_entries_batch', 'cash_entries_batch_group_id_fkey');

    // Restore the original foreign key constraint for group_id with ON DELETE CASCADE
    await queryInterface.addConstraint('cash_entries_batch', {
      fields: ['group_id'],
      type: 'foreign key',
      name: 'cash_entries_batch_group_id_fkey', // Custom constraint name
      references: {
        table: 'group_list',
        field: 'id',
      },
      onDelete: 'CASCADE', // Restore ON DELETE CASCADE
      onUpdate: 'CASCADE', // Retain ON UPDATE CASCADE
    });
  },
};
