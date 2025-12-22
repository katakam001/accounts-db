'use strict';

module.exports = {
    up: async (queryInterface) => {
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

          PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || p_financial_year));
         
          DROP TABLE IF EXISTS date_range;
          CREATE TEMP TABLE date_range AS
          SELECT generate_series(
              (substring(p_financial_year from 1 for 4) || '-04-01')::date,
              (substring(p_financial_year from 6 for 4) || '-03-31')::date,
              '1 day'::interval
          ) AS entry_date;
         
WITH entries_agg AS (
    SELECT entry_date::date AS entry_date, item_id,
           SUM(CASE WHEN type = 1 THEN quantity ELSE 0 END) AS purchase,
           SUM(CASE WHEN type = 2 THEN quantity ELSE 0 END) AS sales,
           SUM(CASE WHEN type IN (4, 6) THEN quantity ELSE 0 END) AS sale_return,
           SUM(CASE WHEN type IN (3, 5) THEN quantity ELSE 0 END) AS purchase_return
    FROM public.entries
    WHERE financial_year = p_financial_year
      AND user_id = p_user_id
      AND item_id = p_item_id
    GROUP BY entry_date::date, item_id
),
cash_sales_agg AS (
    SELECT entry_date::date AS entry_date, item_id,
           SUM(CASE WHEN type = 8 THEN quantity ELSE 0 END) AS cash_sales
    FROM public.cash_sale_entries
    WHERE financial_year = p_financial_year
      AND user_id = p_user_id
      AND item_id = p_item_id
    GROUP BY entry_date::date, item_id
),
entries_data AS (
    SELECT dr.entry_date::date AS entry_date, i.id AS item_id,
           COALESCE(ea.purchase, 0) AS purchase,
           COALESCE(ea.sales, 0) + COALESCE(csa.cash_sales, 0) AS sales,
           COALESCE(ea.sale_return, 0) AS sale_return,
           COALESCE(ea.purchase_return, 0) AS purchase_return,
           COALESCE(ea.purchase, 0)
           + COALESCE(ea.sale_return, 0)
           - COALESCE(ea.sales, 0)
           - COALESCE(ea.purchase_return, 0)
           - COALESCE(csa.cash_sales, 0) AS quantity,
           COALESCE(ea.purchase, 0)
           + COALESCE(ea.sale_return, 0)
           - COALESCE(ea.sales, 0)
           - COALESCE(ea.purchase_return, 0)
           - COALESCE(csa.cash_sales, 0) AS closing_balance,
           p_financial_year AS financial_year,
           p_user_id AS user_id
    FROM date_range dr
    LEFT JOIN public.items i ON i.id = p_item_id
    LEFT JOIN entries_agg ea ON ea.entry_date = dr.entry_date AND ea.item_id = i.id
    LEFT JOIN cash_sales_agg csa ON csa.entry_date = dr.entry_date AND csa.item_id = i.id
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
          SET opening_balance = EXCLUDED.opening_balance,
              quantity = EXCLUDED.quantity,
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
WHERE user_id = p_user_id
  AND financial_year = p_financial_year
  AND item_id = p_item_id;
           

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

          PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || p_financial_year));
         
          DROP TABLE IF EXISTS date_range;
          CREATE TEMP TABLE date_range AS
          SELECT generate_series(
              (substring(p_financial_year from 1 for 4) || '-04-01')::date,
              (substring(p_financial_year from 6 for 4) || '-03-31')::date,
              '1 day'::interval
          ) AS entry_date;
         
WITH entries_agg AS (
    SELECT entry_date::date AS entry_date, item_id,
           SUM(CASE WHEN type = 1 THEN quantity ELSE 0 END) AS purchase,
           SUM(CASE WHEN type = 2 THEN -quantity ELSE 0 END) AS sales,
           SUM(CASE WHEN type IN (4, 6) THEN quantity ELSE 0 END) AS sale_return,
           SUM(CASE WHEN type IN (3, 5) THEN -quantity ELSE 0 END) AS purchase_return
    FROM public.entries
    WHERE financial_year = p_financial_year
      AND user_id = p_user_id
      AND item_id = p_item_id
    GROUP BY entry_date::date, item_id
),
cash_sales_agg AS (
    SELECT entry_date::date AS entry_date, item_id,
           SUM(CASE WHEN type = 8 THEN -quantity ELSE 0 END) AS cash_sales
    FROM public.cash_sale_entries
    WHERE financial_year = p_financial_year
      AND user_id = p_user_id
      AND item_id = p_item_id
    GROUP BY entry_date::date, item_id
),
entries_data AS (
    SELECT dr.entry_date::date AS entry_date, i.id AS item_id,
           COALESCE(ea.purchase, 0) AS purchase,
           COALESCE(ea.sales, 0) + COALESCE(csa.cash_sales, 0) AS sales,
           COALESCE(ea.sale_return, 0) AS sale_return,
           COALESCE(ea.purchase_return, 0) AS purchase_return,
           COALESCE(ea.purchase, 0)
           + COALESCE(ea.sale_return, 0)
           - COALESCE(ea.sales, 0)
           - COALESCE(ea.purchase_return, 0)
           + COALESCE(csa.cash_sales, 0) AS quantity,
           COALESCE(ea.purchase, 0)
           + COALESCE(ea.sale_return, 0)
           - COALESCE(ea.sales, 0)
           - COALESCE(ea.purchase_return, 0)
           + COALESCE(csa.cash_sales, 0) AS closing_balance,
           p_financial_year AS financial_year,
           p_user_id AS user_id
    FROM date_range dr
    LEFT JOIN public.items i ON i.id = p_item_id
    LEFT JOIN entries_agg ea ON ea.entry_date = dr.entry_date AND ea.item_id = i.id
    LEFT JOIN cash_sales_agg csa ON csa.entry_date = dr.entry_date AND csa.item_id = i.id
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
          SET opening_balance = EXCLUDED.opening_balance,
              quantity = EXCLUDED.quantity,
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
WHERE user_id = p_user_id
  AND financial_year = p_financial_year
  AND item_id = p_item_id;
           

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
