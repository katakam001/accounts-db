'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE PROCEDURE generate_stock_register_for_all_items(
          IN p_user_id INT,
          IN p_financial_year TEXT
      )
      LANGUAGE plpgsql
      AS $$
      DECLARE
          v_item_id INT;
      BEGIN
          FOR v_item_id IN
              SELECT DISTINCT item_id
              FROM entries
              WHERE user_id = p_user_id
                AND financial_year = p_financial_year
          LOOP
              CALL generate_stock_register(v_item_id, p_user_id, p_financial_year);
          END LOOP;
      END;
      $$;
    `);

    await queryInterface.sequelize.query(`
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
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`DROP PROCEDURE IF EXISTS generate_closing_stock_for_all_items;`);
    await queryInterface.sequelize.query(`DROP PROCEDURE IF EXISTS generate_stock_register_for_all_items;`);
  }
};
