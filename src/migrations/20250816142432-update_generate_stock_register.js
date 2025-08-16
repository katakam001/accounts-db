'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE PROCEDURE public.generate_stock_register(
          IN p_item_id integer,
          IN p_user_id integer,
          IN p_financial_year text
      )
      LANGUAGE plpgsql
      AS $procedure$
      DECLARE
          rec RECORD;
          v_date_range_table text := format('date_range_%s', p_item_id);
          v_temp_stock_table text := format('temp_stock_register_%s', p_item_id);
      BEGIN
          RAISE NOTICE 'Starting procedure with parameters: %, %, %', p_item_id, p_user_id, p_financial_year;

          PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || p_financial_year || p_item_id::text));
          RAISE NOTICE 'Acquired advisory lock';

          EXECUTE format('DROP TABLE IF EXISTS %I', v_date_range_table);
          EXECUTE format('CREATE TEMP TABLE %I AS
              SELECT generate_series(
                  (substring(%L from 1 for 4) || ''-04-01'')::date,
                  (substring(%L from 6 for 4) || ''-03-31'')::date,
                  ''1 day''::interval
              ) AS entry_date', v_date_range_table, p_financial_year, p_financial_year);

          EXECUTE format($f$
              WITH entries_data AS (
                  SELECT i.id AS item_id, dr.entry_date::date AS entry_date,
                         COALESCE(SUM(CASE WHEN e.type = 1 THEN e.quantity ELSE 0 END), 0) AS purchase,
                         COALESCE(SUM(CASE WHEN e.type = 2 THEN -e.quantity ELSE 0 END), 0) AS sales,
                         COALESCE(SUM(CASE WHEN e.type IN (4, 6) THEN e.quantity ELSE 0 END), 0) AS sale_return,
                         COALESCE(SUM(CASE WHEN e.type IN (3, 5) THEN -e.quantity ELSE 0 END), 0) AS purchase_return,
                         COALESCE(SUM(CASE WHEN e.type = 1 THEN e.quantity
                                           WHEN e.type IN (2, 3, 5) THEN -e.quantity
                                           WHEN e.type IN (4, 6) THEN e.quantity ELSE 0 END), 0) AS quantity,
                         COALESCE(SUM(CASE WHEN e.type = 1 THEN e.quantity
                                           WHEN e.type IN (2, 3, 5) THEN -e.quantity
                                           WHEN e.type IN (4, 6) THEN e.quantity ELSE 0 END), 0) AS closing_balance,
                         %L AS financial_year,
                         %s AS user_id
                  FROM %I dr
                  LEFT JOIN public.items i ON i.id = %s
                  LEFT JOIN public.entries e ON dr.entry_date::date = e.entry_date::date
                      AND e.item_id = i.id AND e.financial_year = %L AND e.user_id = %s
                  GROUP BY i.id, dr.entry_date::date
              ),
              production_data AS (
                  SELECT i.id AS item_id, dr.entry_date::date AS entry_date,
                         COALESCE(SUM(CASE WHEN pe.production_entry_id IS NULL AND pe.raw_item_id = i.id THEN pe.quantity ELSE 0 END), 0) AS Dispatch_To_process,
                         COALESCE(SUM(CASE WHEN pe.production_entry_id IS NOT NULL AND pe.item_id = i.id THEN pe.quantity ELSE 0 END), 0) AS Received_From_process
                  FROM %I dr
                  LEFT JOIN public.items i ON i.id = %s
                  LEFT JOIN public.production_entries pe ON dr.entry_date::date = pe.production_date::date
                      AND pe.financial_year = %L AND pe.user_id = %s
                  GROUP BY i.id, dr.entry_date::date
              )
          INSERT INTO public.stock_register (item_id, entry_date, opening_balance, quantity, closing_balance, entry_type, user_id, financial_year, Dispatch_To_process, Received_From_process, purchase, sales, sale_return, purchase_return)
    SELECT ed.item_id, ed.entry_date,
           CASE WHEN ed.entry_date::date = (substring(%L from 1 for 4) || '-04-01')::date THEN
                COALESCE((SELECT quantity FROM opening_stock WHERE user_id = %s AND financial_year = %L AND item_id = %s), 0)
           ELSE 0 END AS opening_balance,
           ed.quantity,
           ed.closing_balance - COALESCE(pd.Dispatch_To_process, 0) + COALESCE(pd.Received_From_process, 0) AS closing_balance,
           'Combined Entry' AS entry_type,
           %s, %L,
           pd.Dispatch_To_process,
           pd.Received_From_process,
           ed.purchase,
           ed.sales,
           ed.sale_return,
           ed.purchase_return
    FROM entries_data ed
    LEFT JOIN production_data pd ON ed.item_id = pd.item_id AND ed.entry_date = pd.entry_date
    WHERE ed.financial_year = %L AND ed.user_id = %s
          ON CONFLICT (item_id, entry_date, user_id, financial_year) DO UPDATE
          SET quantity = EXCLUDED.quantity,
        closing_balance = EXCLUDED.closing_balance,
        Dispatch_To_process = EXCLUDED.Dispatch_To_process,
        Received_From_process = EXCLUDED.Received_From_process,
        purchase = EXCLUDED.purchase,
        sales = EXCLUDED.sales,
        sale_return = EXCLUDED.sale_return,
        purchase_return = EXCLUDED.purchase_return;
          $f$,
          p_financial_year, p_user_id, v_date_range_table, p_item_id, p_financial_year, p_user_id,
          v_date_range_table, p_item_id, p_financial_year, p_user_id,
          p_financial_year, p_user_id, p_item_id, p_user_id, p_financial_year, p_item_id,
          p_financial_year, p_user_id);

          EXECUTE format('DROP TABLE IF EXISTS %I', v_temp_stock_table);
          EXECUTE format('CREATE TEMP TABLE %I AS SELECT * FROM public.stock_register WHERE user_id = %s AND financial_year = %L', v_temp_stock_table, p_user_id, p_financial_year);

          FOR rec IN EXECUTE format('SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process FROM %I ORDER BY item_id, entry_date', v_temp_stock_table)
          LOOP
              IF rec.entry_date = (substring(p_financial_year from 1 for 4) || '-04-01')::date THEN
                  EXECUTE format('UPDATE %I SET closing_balance = opening_balance + %s + %s - %s WHERE id = %s',
                      v_temp_stock_table, rec.quantity, rec.Received_From_process, rec.Dispatch_To_process, rec.id);
              ELSE
                  EXECUTE format('UPDATE %I SET opening_balance = COALESCE((SELECT closing_balance FROM %I WHERE item_id = %s AND entry_date = %L::date - INTERVAL ''1 day''), 0),
                                             closing_balance = COALESCE((SELECT closing_balance FROM %I WHERE item_id = %s AND entry_date = %L::date - INTERVAL ''1 day''), 0) + %s + %s - %s
                                 WHERE id = %s',
                      v_temp_stock_table, v_temp_stock_table, rec.item_id, rec.entry_date, v_temp_stock_table, rec.item_id, rec.entry_date,
                      rec.quantity, rec.Received_From_process, rec.Dispatch_To_process, rec.id);
              END IF;
          END LOOP;

          EXECUTE format('UPDATE public.stock_register sr SET opening_balance = tsr.opening_balance, closing_balance = tsr.closing_balance FROM %I tsr WHERE sr.id = tsr.id', v_temp_stock_table);

          WITH consolidated_data AS (
              SELECT item_id,
                     SUM(purchase) AS total_purchase,
                     SUM(sales) AS total_sales,
                     SUM(sale_return) AS total_sale_return,
                     SUM(purchase_return) AS total_purchase_return,
                     SUM(quantity) AS total_quantity,
                     (SELECT closing_balance FROM public.stock_register WHERE user_id = p_user_id AND financial_year = p_financial_year AND item_id = p_item_id ORDER BY entry_date DESC LIMIT 1) AS total_closing_balance,
                     SUM(Dispatch_To_process) AS total_dispatch_to_process,
                     SUM(Received_From_process) AS total_received_from_process,
                     user_id,
                     financial_year
              FROM public.stock_register
              WHERE user_id = p_user_id AND financial_year = p_financial_year AND item_id = p_item_id
              GROUP BY item_id, user_id, financial_year
          )
          INSERT INTO public.consolidated_stock_register (item_id, total_purchase, total_sales, total_sale_return, total_purchase_return, total_quantity, total_closing_balance, total_dispatch_to_process, total_received_from_process, user_id, financial_year)
          SELECT item_id, total_purchase, total_sales, total_sale_return, total_purchase_return, total_quantity, total_closing_balance, total_dispatch_to_process, total_received_from_process, user_id, financial_year
          FROM consolidated_data
          ON CONFLICT (item_id, user_id, financial_year) DO UPDATE
          SET total_purchase = EXCLUDED.total_purchase,
              total_sales = EXCLUDED.total_sales,
              total_sale_return = EXCLUDED.total_sale_return,
              total_purchase_return = EXCLUDED.total_purchase_return,
              total_quantity = EXCLUDED.total_quantity,
              total_closing_balance = EXCLUDED.total_closing_balance,
              total_dispatch_to_process = EXCLUDED.total_dispatch_to_process,
              total_received_from_process = EXCLUDED.total_received_from_process;
      END;
      $procedure$;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE PROCEDURE public.generate_stock_register(
          IN p_item_id INTEGER,
          IN p_user_id INTEGER,
          IN p_financial_year TEXT
      )
      LANGUAGE plpgsql
      AS $procedure$
      DECLARE
          rec RECORD;
      BEGIN
          RAISE NOTICE 'Starting procedure with parameters: %, %, %', p_item_id, p_user_id, p_financial_year;

          PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || p_financial_year));
          RAISE NOTICE 'Acquired advisory lock';

          DROP TABLE IF EXISTS date_range;
          CREATE TEMP TABLE date_range AS
          SELECT generate_series(
              (substring(p_financial_year from 1 for 4) || '-04-01')::date,
              (substring(p_financial_year from 6 for 4) || '-03-31')::date,
              '1 day'::interval
          ) AS entry_date;

          WITH entries_data AS (
              SELECT i.id AS item_id, dr.entry_date::date AS entry_date,
                     COALESCE(SUM(CASE WHEN e.type = 1 THEN e.quantity ELSE 0 END), 0) AS purchase,
                     COALESCE(SUM(CASE WHEN e.type = 2 THEN -e.quantity ELSE 0 END), 0) AS sales,
                     COALESCE(SUM(CASE WHEN e.type IN (4, 6) THEN e.quantity ELSE 0 END), 0) AS sale_return,
                     COALESCE(SUM(CASE WHEN e.type IN (3, 5) THEN -e.quantity ELSE 0 END), 0) AS purchase_return,
                     COALESCE(SUM(CASE WHEN e.type = 1 THEN e.quantity
                                       WHEN e.type IN (2, 3, 5) THEN -e.quantity
                                       WHEN e.type IN (4, 6) THEN e.quantity ELSE 0 END), 0) AS quantity,
                     COALESCE(SUM(CASE WHEN e.type = 1 THEN e.quantity
                                       WHEN e.type IN (2, 3, 5) THEN -e.quantity
                                       WHEN e.type IN (4, 6) THEN e.quantity ELSE 0 END), 0) AS closing_balance,
                     p_financial_year AS financial_year,
                     p_user_id AS user_id
              FROM date_range dr
              LEFT JOIN public.items i ON i.id = p_item_id
              LEFT JOIN public.entries e ON dr.entry_date::date = e.entry_date::date
                  AND e.item_id = i.id AND e.financial_year = p_financial_year AND e.user_id = p_user_id
              GROUP BY i.id, dr.entry_date::date
          ),
          production_data AS (
              SELECT i.id AS item_id, dr.entry_date::date AS entry_date,
                     COALESCE(SUM(CASE WHEN pe.production_entry_id IS NULL AND pe.raw_item_id = i.id THEN pe.quantity ELSE 0 END), 0) AS Dispatch_To_process,
                     COALESCE(SUM(CASE WHEN pe.production_entry_id IS NOT NULL AND pe.item_id = i.id THEN pe.quantity ELSE 0 END), 0) AS Received_From_process
              FROM date_range dr
              LEFT JOIN public.items i ON i.id = p_item_id
              LEFT JOIN public.production_entries pe ON dr.entry_date::date = pe.production_date::date
                  AND pe.financial_year = p_financial_year AND pe.user_id = p_user_id
              GROUP BY i.id, dr.entry_date::date
          )
          INSERT INTO public.stock_register (item_id, entry_date, opening_balance, quantity, closing_balance, entry_type, user_id, financial_year, Dispatch_To_process, Received_From_process, purchase, sales, sale_return, purchase_return)
          SELECT ed.item_id, ed.entry_date,
                 CASE WHEN ed.entry_date::date = (substring(p_financial_year from 1 for 4) || '-04-01')::date THEN
                      COALESCE((SELECT quantity FROM opening_stock WHERE user_id = p_user_id AND financial_year = p_financial_year AND item_id = p_item_id), 0)
                      ELSE 0 END AS opening_balance,
                 ed.quantity,
                 ed.closing_balance - COALESCE(pd.Dispatch_To_process, 0) + COALESCE(pd.Received_From_process, 0) AS closing_balance,
                 'Combined Entry' AS entry_type,
                 p_user_id, p_financial_year,
                 pd.Dispatch_To_process,
                 pd.Received_From_process,
                 ed.purchase,
                 ed.sales,
                 ed.sale_return,
                 ed.purchase_return
          FROM entries_data ed
          LEFT JOIN production_data pd ON ed.item_id = pd.item_id AND ed.entry_date = pd.entry_date
          WHERE ed.financial_year = p_financial_year AND ed.user_id = p_user_id
          ON CONFLICT (item_id, entry_date, user_id, financial_year) DO UPDATE
          SET quantity = EXCLUDED.quantity,
              closing_balance = EXCLUDED.closing_balance,
              Dispatch_To_process = EXCLUDED.Dispatch_To_process,
              Received_From_process = EXCLUDED.Received_From_process,
              purchase = EXCLUDED.purchase,
              sales = EXCLUDED.sales,
              sale_return = EXCLUDED.sale_return,
              purchase_return = EXCLUDED.purchase_return;

          DROP TABLE IF EXISTS temp_stock_register;
          CREATE TEMP TABLE temp_stock_register AS
          SELECT * FROM public.stock_register
          WHERE user_id = p_user_id AND financial_year = p_financial_year;

          FOR rec IN
              SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process
              FROM temp_stock_register
              ORDER BY item_id, entry_date
          LOOP
          	          IF rec.entry_date = (substring(p_financial_year from 1 for 4) || '-04-01')::date THEN
  UPDATE temp_stock_register
  SET closing_balance = opening_balance + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
  WHERE id = rec.id;
ELSE
              UPDATE temp_stock_register
              SET opening_balance = COALESCE((SELECT closing_balance FROM temp_stock_register WHERE item_id = rec.item_id AND entry_date = rec.entry_date - INTERVAL '1 day'), 0),
                  closing_balance = COALESCE((SELECT closing_balance FROM temp_stock_register WHERE item_id = rec.item_id AND entry_date = rec.entry_date - INTERVAL '1 day'), 0) + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
              WHERE id = rec.id;
END IF;
          END LOOP;

          UPDATE public.stock_register sr
          SET opening_balance = tsr.opening_balance,
              closing_balance = tsr.closing_balance
          FROM temp_stock_register tsr
          WHERE sr.id = tsr.id;

          WITH consolidated_data AS (
              SELECT item_id,
                     SUM(purchase) AS total_purchase,
                     SUM(sales) AS total_sales,
                     SUM(sale_return) AS total_sale_return,
                     SUM(purchase_return) AS total_purchase_return,
                     SUM(quantity) AS total_quantity,
                     (SELECT closing_balance FROM public.stock_register WHERE user_id = p_user_id AND financial_year = p_financial_year AND item_id = p_item_id ORDER BY entry_date DESC LIMIT 1) AS total_closing_balance,
                     SUM(Dispatch_To_process) AS total_dispatch_to_process,
                     SUM(Received_From_process) AS total_received_from_process,
                     user_id,
                     financial_year
              FROM public.stock_register
              WHERE user_id = p_user_id AND financial_year = p_financial_year AND item_id = p_item_id
              GROUP BY item_id, user_id, financial_year
          )
          INSERT INTO public.consolidated_stock_register (item_id, total_purchase, total_sales, total_sale_return, total_purchase_return, total_quantity, total_closing_balance, total_dispatch_to_process, total_received_from_process, user_id, financial_year)
          SELECT item_id, total_purchase, total_sales, total_sale_return, total_purchase_return, total_quantity, total_closing_balance, total_dispatch_to_process, total_received_from_process, user_id, financial_year
          FROM consolidated_data
          ON CONFLICT (item_id, user_id, financial_year) DO UPDATE
          SET total_purchase = EXCLUDED.total_purchase,
              total_sales = EXCLUDED.total_sales,
              total_sale_return = EXCLUDED.total_sale_return,
              total_purchase_return = EXCLUDED.total_purchase_return,
              total_quantity = EXCLUDED.total_quantity,
              total_closing_balance = EXCLUDED.total_closing_balance,
              total_dispatch_to_process = EXCLUDED.total_dispatch_to_process,
              total_received_from_process = EXCLUDED.total_received_from_process;
      END;
      $procedure$;
    `);
  }
};
