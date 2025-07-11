'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the existing `combined_cash_entries` view
    await queryInterface.sequelize.query(`
      DROP VIEW IF EXISTS combined_cash_entries;
    `);

    // Create the enhanced view including `is_cash_adjustment`
    await queryInterface.sequelize.query(`
      CREATE VIEW combined_cash_entries AS
      SELECT 
          'CE_' || CAST(id AS VARCHAR) AS unique_entry_id,
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
          is_cash_adjustment,
          'realtime' AS source_table
      FROM 
          public.cash_entries
      UNION ALL
      SELECT 
          'CEB_' || CAST(id AS VARCHAR) AS unique_entry_id,
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
          is_cash_adjustment,
          'batch' AS source_table
      FROM 
          public.cash_entries_batch;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Drop the updated view (with is_cash_adjustment)
    await queryInterface.sequelize.query(`
      DROP VIEW IF EXISTS combined_cash_entries;
    `);

    // Recreate the previous version without `is_cash_adjustment`
    await queryInterface.sequelize.query(`
      CREATE VIEW combined_cash_entries AS
      SELECT 
          'CE_' || CAST(id AS VARCHAR) AS unique_entry_id,
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
      FROM 
          public.cash_entries
      UNION ALL
      SELECT 
          'CEB_' || CAST(id AS VARCHAR) AS unique_entry_id,
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
      FROM 
          public.cash_entries_batch;
    `);
  },
};
