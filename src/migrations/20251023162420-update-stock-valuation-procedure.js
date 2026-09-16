'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP PROCEDURE IF EXISTS generate_closing_stock_for_all_items;

      CREATE OR REPLACE PROCEDURE public.generate_stock_valuation_for_all_items(
          IN p_user_id integer,
          IN p_financial_year text,
          IN p_start_date date,
          IN p_end_date date
      )
      LANGUAGE plpgsql
      AS $procedure$
      BEGIN
          CALL public.generate_stock_register_bulk(p_user_id, p_financial_year);
          CALL populate_temp_stock_ledger(p_user_id, p_financial_year, p_start_date, p_end_date);
      END;
      $procedure$;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP PROCEDURE IF EXISTS public.generate_stock_valuation_for_all_items;

      CREATE OR REPLACE PROCEDURE generate_closing_stock_for_all_items(
          IN p_user_id INT,
          IN p_financial_year TEXT,
          IN p_start_date DATE,
          IN p_end_date DATE
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
          CALL generate_stock_register_for_all_items(p_user_id, p_financial_year);
          CALL populate_temp_stock_ledger(p_user_id, p_financial_year, p_start_date, p_end_date);
      END;
      $$;
    `);
  }
};
