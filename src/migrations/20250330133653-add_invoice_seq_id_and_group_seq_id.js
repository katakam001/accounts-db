'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add invoice_seq_id column to entries table
    await queryInterface.addColumn('entries', 'invoice_seq_id', {
      type: Sequelize.BIGINT,
      allowNull: true, // Allow null for backward compatibility
    });

    // Add invoice_seq_id column to journal_entries table
    await queryInterface.addColumn('journal_entries', 'invoice_seq_id', {
      type: Sequelize.BIGINT,
      allowNull: true, // Allow null for backward compatibility
    });

    // Create group_entries_seq sequence in the database
    await queryInterface.sequelize.query(`
      CREATE SEQUENCE IF NOT EXISTS group_entries_seq START 1;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove invoice_seq_id column from entries table
    await queryInterface.removeColumn('entries', 'invoice_seq_id');

    // Remove invoice_seq_id column from journal_entries table
    await queryInterface.removeColumn('journal_entries', 'invoice_seq_id');

    // Drop group_entries_seq sequence
    await queryInterface.sequelize.query(`
      DROP SEQUENCE IF EXISTS group_entries_seq;
    `);
  },
};
