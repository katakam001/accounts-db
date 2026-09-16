'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Drop the view to remove dependency
    await queryInterface.sequelize.query(`
      DROP VIEW IF EXISTS combined_cash_entries;
    `);

    // Step 2: Alter transaction_id in both tables
    await queryInterface.changeColumn('cash_entries', 'transaction_id', {
      type: Sequelize.STRING(64),
      allowNull: true
    });

    await queryInterface.changeColumn('cash_entries_batch', 'transaction_id', {
      type: Sequelize.STRING(64),
      allowNull: true
    });

    // Step 3: Recreate the view with your preferred definition
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
    // Step 1: Drop the view
    await queryInterface.sequelize.query(`
      DROP VIEW IF EXISTS combined_cash_entries;
    `);

    // Step 2: Revert transaction_id back to varchar(30)
    await queryInterface.changeColumn('cash_entries', 'transaction_id', {
      type: Sequelize.STRING(30),
      allowNull: true
    });

    await queryInterface.changeColumn('cash_entries_batch', 'transaction_id', {
      type: Sequelize.STRING(30),
      allowNull: true
    });

    // Step 3: Recreate the view with old definition
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
  }
};
