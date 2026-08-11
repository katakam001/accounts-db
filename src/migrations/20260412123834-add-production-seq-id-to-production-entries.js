'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the new column (no unique constraint)
    await queryInterface.addColumn('production_entries', 'production_seq_id', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });

    // Backfill existing root entries (production_entry_id IS NULL)
    await queryInterface.sequelize.query(`
      UPDATE public.production_entries
      SET production_seq_id = nextval('group_entries_seq')
      WHERE production_entry_id IS NULL
        AND production_seq_id IS NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Rollback: remove the column
    await queryInterface.removeColumn('production_entries', 'production_seq_id');
  }
};
