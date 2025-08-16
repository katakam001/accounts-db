'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE PROCEDURE public.generate_stock_register_for_all_items(
        IN p_user_id integer,
        IN p_financial_year text
      )
      LANGUAGE plpgsql
      AS $procedure$
      DECLARE
          v_item_id INT;
      BEGIN
          FOR v_item_id IN
              SELECT DISTINCT item_id
              FROM (
                  SELECT item_id
                  FROM entries
                  WHERE user_id = p_user_id
                    AND financial_year = p_financial_year

                  UNION

                  SELECT item_id
                  FROM opening_stock
                  WHERE user_id = p_user_id
                    AND financial_year = p_financial_year
              ) AS combined_items
          LOOP
              CALL generate_stock_register(v_item_id, p_user_id, p_financial_year);
          END LOOP;
      END;
      $procedure$;
    `);
  },

  down: async (queryInterface, Sequelize) => {
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
  }
};
