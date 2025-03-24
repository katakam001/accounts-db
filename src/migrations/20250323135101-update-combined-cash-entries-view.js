'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the existing `combined_cash_entries` view if it exists
    await queryInterface.sequelize.query(`
      DROP VIEW IF EXISTS combined_cash_entries;
    `);

    // Create the updated `combined_cash_entries` view
    await queryInterface.sequelize.query(`
      CREATE VIEW combined_cash_entries AS
      SELECT 
          'CE_' || CAST(id AS VARCHAR) AS unique_entry_id, -- Add new column for unique ID
          id, -- Retain the original id column
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
          'CEB_' || CAST(id AS VARCHAR) AS unique_entry_id, -- Add new column for unique ID
          id, -- Retain the original id column
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

  async down(queryInterface, Sequelize) {
    // Drop the updated `combined_cash_entries` view
    await queryInterface.sequelize.query(`
      DROP VIEW IF EXISTS combined_cash_entries;
    `);

    // Recreate the original `combined_cash_entries` view
    await queryInterface.sequelize.query(`
      CREATE VIEW combined_cash_entries AS
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
      FROM 
          public.cash_entries
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
      FROM 
          public.cash_entries_batch;
    `);
  },
};
