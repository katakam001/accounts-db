'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    // Step 2: Create `combined_cash_entries` view
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE VIEW combined_cash_entries AS
      SELECT 
          id,
          user_id,
          financial_year,
          cash_date,
          narration,
          account_id,
          "type",
          amount,
          transaction_id,
          group_id,
          'realtime' AS source_table
      FROM public.cash_entries
      UNION ALL
      SELECT 
          id,
          user_id,
          financial_year,
          cash_date,
          narration,
          account_id,
          "type",
          amount,
          transaction_id,
          group_id,
          'batch' AS source_table
      FROM public.cash_entries_batch;
    `);

    // Step 3: Add indexes for optimized queries
    await queryInterface.addIndex('cash_entries_batch', ['user_id', 'financial_year'], {
      name: 'idx_cash_entries_batch_user_financial_year',
    });

    await queryInterface.addIndex('cash_entries_batch', ['cash_date'], {
      name: 'idx_cash_entries_batch_cash_date',
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop the indexes first
    await queryInterface.removeIndex('cash_entries_batch', 'idx_cash_entries_batch_user_financial_year');
    await queryInterface.removeIndex('cash_entries_batch', 'idx_cash_entries_batch_cash_date');

    // Drop the `combined_cash_entries` view
    await queryInterface.sequelize.query(`
      DROP VIEW IF EXISTS combined_cash_entries;
    `);

  },
};
