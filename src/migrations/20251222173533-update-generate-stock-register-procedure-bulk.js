'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE PROCEDURE public.generate_stock_register_bulk(
          IN p_user_id integer,
          IN p_financial_year text
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
          )::date AS entry_date;
         

          DROP TABLE IF EXISTS item_list;
          CREATE TEMP TABLE item_list AS
          SELECT DISTINCT item_id
          FROM (
              SELECT item_id FROM entries WHERE user_id = p_user_id AND financial_year = p_financial_year
              UNION
              SELECT item_id FROM cash_sale_entries WHERE user_id = p_user_id AND financial_year = p_financial_year
              UNION
              SELECT item_id FROM opening_stock WHERE user_id = p_user_id AND financial_year = p_financial_year
          ) AS combined;
         

-- Step 1: Drop the temp table first
DROP TABLE IF EXISTS temp_entries_data;

-- Step 2: Create it using WITH clause
CREATE TEMP TABLE temp_entries_data AS
WITH entries_agg AS (
    SELECT item_id, entry_date::date AS entry_date,
           SUM(CASE WHEN type = 1 THEN quantity ELSE 0 END) AS purchase,
           SUM(CASE WHEN type = 2 THEN quantity ELSE 0 END) AS sales,
           SUM(CASE WHEN type IN (4, 6) THEN quantity ELSE 0 END) AS sale_return,
           SUM(CASE WHEN type IN (3, 5) THEN quantity ELSE 0 END) AS purchase_return
    FROM entries
    WHERE user_id = p_user_id AND financial_year = p_financial_year
    GROUP BY item_id, entry_date::date
),
cash_sales_agg AS (
    SELECT item_id, entry_date::date AS entry_date,
           SUM(CASE WHEN type = 8 THEN quantity ELSE 0 END) AS cash_sales
    FROM cash_sale_entries
    WHERE user_id = p_user_id AND financial_year = p_financial_year
    GROUP BY item_id, entry_date::date
)
SELECT 
    i.item_id,
    dr.entry_date,
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
    - COALESCE(csa.cash_sales, 0) AS closing_balance
FROM date_range dr
CROSS JOIN item_list i
LEFT JOIN entries_agg ea ON ea.entry_date = dr.entry_date AND ea.item_id = i.item_id
LEFT JOIN cash_sales_agg csa ON csa.entry_date = dr.entry_date AND csa.item_id = i.item_id;


          DROP TABLE IF EXISTS temp_production_data;
          CREATE TEMP TABLE temp_production_data AS
          SELECT 
              i.item_id,
              dr.entry_date,
              COALESCE(SUM(CASE WHEN pe.production_entry_id IS NULL AND pe.raw_item_id = i.item_id THEN pe.quantity ELSE 0 END), 0) AS Dispatch_To_process,
              COALESCE(SUM(CASE WHEN pe.production_entry_id IS NOT NULL AND pe.item_id = i.item_id THEN pe.quantity ELSE 0 END), 0) AS Received_From_process
          FROM date_range dr
          CROSS JOIN item_list i
          LEFT JOIN production_entries pe ON dr.entry_date = pe.production_date::date
              AND pe.user_id = p_user_id AND pe.financial_year = p_financial_year
          GROUP BY i.item_id, dr.entry_date;

          INSERT INTO stock_register (
              item_id, entry_date, opening_balance, quantity, closing_balance, entry_type,
              user_id, financial_year, Dispatch_To_process, Received_From_process,
              purchase, sales, sale_return, purchase_return
          )
          SELECT 
              ed.item_id,
              ed.entry_date,
              CASE WHEN ed.entry_date = (substring(p_financial_year from 1 for 4) || '-04-01')::date THEN
                  COALESCE(os.quantity, 0)
              ELSE 0 END AS opening_balance,
              ed.quantity,
              ed.closing_balance - COALESCE(pd.Dispatch_To_process, 0) + COALESCE(pd.Received_From_process, 0) AS closing_balance,
              'Combined Entry',
              p_user_id,
              p_financial_year,
              pd.Dispatch_To_process,
              pd.Received_From_process,
              ed.purchase,
              ed.sales,
              ed.sale_return,
              ed.purchase_return
          FROM temp_entries_data ed
          LEFT JOIN temp_production_data pd ON ed.item_id = pd.item_id AND ed.entry_date = pd.entry_date
          LEFT JOIN opening_stock os ON ed.item_id = os.item_id AND os.user_id = p_user_id AND os.financial_year = p_financial_year
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
          SELECT * FROM stock_register
          WHERE user_id = p_user_id AND financial_year = p_financial_year;
                 
         -- Step 2: Add index to optimize LAG(), sorting, and joins
CREATE INDEX idx_temp_stock_register_item_date
ON temp_stock_register (item_id, entry_date);

WITH RECURSIVE balance_chain AS (
  -- Anchor: first day of financial year
  SELECT
    id,
    item_id,
    entry_date,
    opening_balance,
    quantity,
    Dispatch_To_process,
    Received_From_process,
    opening_balance AS computed_opening,
    opening_balance + quantity + Received_From_process - Dispatch_To_process AS computed_closing
  FROM temp_stock_register
  WHERE entry_date = (substring(p_financial_year from 1 for 4) || '-04-01')::date

  UNION ALL

  -- Recursive step: next day per item
  SELECT
    tsr.id,
    tsr.item_id,
    tsr.entry_date,
    tsr.opening_balance,
    tsr.quantity,
    tsr.Dispatch_To_process,
    tsr.Received_From_process,
    CAST(bc.computed_closing AS numeric(14,4)) AS computed_opening,
    CAST(bc.computed_closing + tsr.quantity + tsr.Received_From_process - tsr.Dispatch_To_process AS numeric(14,4)) AS computed_closing
  FROM temp_stock_register tsr
  JOIN balance_chain bc
    ON tsr.item_id = bc.item_id
   AND tsr.entry_date = bc.entry_date + INTERVAL '1 day'
)
UPDATE temp_stock_register tsr
SET opening_balance = bc.computed_opening,
    closing_balance = bc.computed_closing
FROM balance_chain bc
WHERE tsr.id = bc.id;

          UPDATE stock_register sr
          SET opening_balance = tsr.opening_balance,
              closing_balance = tsr.closing_balance
          FROM temp_stock_register tsr
          WHERE sr.id = tsr.id;
         
          INSERT INTO consolidated_stock_register (
              item_id, total_purchase, total_sales, total_sale_return, total_purchase_return,
              total_quantity, total_closing_balance, total_dispatch_to_process, total_received_from_process,
              user_id, financial_year
          )
          SELECT 
              sr.item_id,
              SUM(sr.purchase),
              SUM(sr.sales),
              SUM(sr.sale_return),
              SUM(sr.purchase_return),
              SUM(sr.quantity),
              (
                  SELECT closing_balance
                  FROM stock_register
                  WHERE user_id = p_user_id AND financial_year = p_financial_year AND item_id = sr.item_id
                  ORDER BY entry_date DESC
                  LIMIT 1
              ) AS total_closing_balance,
              SUM(sr.Dispatch_To_process),
              SUM(sr.Received_From_process),
              p_user_id,
              p_financial_year
          FROM stock_register sr
          WHERE sr.user_id = p_user_id AND sr.financial_year = p_financial_year
          GROUP BY sr.item_id
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
      CREATE OR REPLACE PROCEDURE public.generate_stock_register_bulk(
          IN p_user_id integer,
          IN p_financial_year text
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
          )::date AS entry_date;
         

          DROP TABLE IF EXISTS item_list;
          CREATE TEMP TABLE item_list AS
          SELECT DISTINCT item_id
          FROM (
              SELECT item_id FROM entries WHERE user_id = p_user_id AND financial_year = p_financial_year
              UNION
              SELECT item_id FROM cash_sale_entries WHERE user_id = p_user_id AND financial_year = p_financial_year
              UNION
              SELECT item_id FROM opening_stock WHERE user_id = p_user_id AND financial_year = p_financial_year
          ) AS combined;
         

-- Step 1: Drop the temp table first
DROP TABLE IF EXISTS temp_entries_data;

-- Step 2: Create it using WITH clause
CREATE TEMP TABLE temp_entries_data AS
WITH entries_agg AS (
    SELECT item_id, entry_date::date AS entry_date,
           SUM(CASE WHEN type = 1 THEN quantity ELSE 0 END) AS purchase,
           SUM(CASE WHEN type = 2 THEN -quantity ELSE 0 END) AS sales,
           SUM(CASE WHEN type IN (4, 6) THEN quantity ELSE 0 END) AS sale_return,
           SUM(CASE WHEN type IN (3, 5) THEN -quantity ELSE 0 END) AS purchase_return
    FROM entries
    WHERE user_id = p_user_id AND financial_year = p_financial_year
    GROUP BY item_id, entry_date::date
),
cash_sales_agg AS (
    SELECT item_id, entry_date::date AS entry_date,
           SUM(CASE WHEN type = 8 THEN -quantity ELSE 0 END) AS cash_sales
    FROM cash_sale_entries
    WHERE user_id = p_user_id AND financial_year = p_financial_year
    GROUP BY item_id, entry_date::date
)
SELECT 
    i.item_id,
    dr.entry_date,
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
    + COALESCE(csa.cash_sales, 0) AS closing_balance
FROM date_range dr
CROSS JOIN item_list i
LEFT JOIN entries_agg ea ON ea.entry_date = dr.entry_date AND ea.item_id = i.item_id
LEFT JOIN cash_sales_agg csa ON csa.entry_date = dr.entry_date AND csa.item_id = i.item_id;


          DROP TABLE IF EXISTS temp_production_data;
          CREATE TEMP TABLE temp_production_data AS
          SELECT 
              i.item_id,
              dr.entry_date,
              COALESCE(SUM(CASE WHEN pe.production_entry_id IS NULL AND pe.raw_item_id = i.item_id THEN pe.quantity ELSE 0 END), 0) AS Dispatch_To_process,
              COALESCE(SUM(CASE WHEN pe.production_entry_id IS NOT NULL AND pe.item_id = i.item_id THEN pe.quantity ELSE 0 END), 0) AS Received_From_process
          FROM date_range dr
          CROSS JOIN item_list i
          LEFT JOIN production_entries pe ON dr.entry_date = pe.production_date::date
              AND pe.user_id = p_user_id AND pe.financial_year = p_financial_year
          GROUP BY i.item_id, dr.entry_date;

          INSERT INTO stock_register (
              item_id, entry_date, opening_balance, quantity, closing_balance, entry_type,
              user_id, financial_year, Dispatch_To_process, Received_From_process,
              purchase, sales, sale_return, purchase_return
          )
          SELECT 
              ed.item_id,
              ed.entry_date,
              CASE WHEN ed.entry_date = (substring(p_financial_year from 1 for 4) || '-04-01')::date THEN
                  COALESCE(os.quantity, 0)
              ELSE 0 END AS opening_balance,
              ed.quantity,
              ed.closing_balance - COALESCE(pd.Dispatch_To_process, 0) + COALESCE(pd.Received_From_process, 0) AS closing_balance,
              'Combined Entry',
              p_user_id,
              p_financial_year,
              pd.Dispatch_To_process,
              pd.Received_From_process,
              ed.purchase,
              ed.sales,
              ed.sale_return,
              ed.purchase_return
          FROM temp_entries_data ed
          LEFT JOIN temp_production_data pd ON ed.item_id = pd.item_id AND ed.entry_date = pd.entry_date
          LEFT JOIN opening_stock os ON ed.item_id = os.item_id AND os.user_id = p_user_id AND os.financial_year = p_financial_year
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
          SELECT * FROM stock_register
          WHERE user_id = p_user_id AND financial_year = p_financial_year;
                 
         -- Step 2: Add index to optimize LAG(), sorting, and joins
CREATE INDEX idx_temp_stock_register_item_date
ON temp_stock_register (item_id, entry_date);

WITH RECURSIVE balance_chain AS (
  -- Anchor: first day of financial year
  SELECT
    id,
    item_id,
    entry_date,
    opening_balance,
    quantity,
    Dispatch_To_process,
    Received_From_process,
    opening_balance AS computed_opening,
    opening_balance + quantity + Received_From_process - Dispatch_To_process AS computed_closing
  FROM temp_stock_register
  WHERE entry_date = (substring(p_financial_year from 1 for 4) || '-04-01')::date

  UNION ALL

  -- Recursive step: next day per item
  SELECT
    tsr.id,
    tsr.item_id,
    tsr.entry_date,
    tsr.opening_balance,
    tsr.quantity,
    tsr.Dispatch_To_process,
    tsr.Received_From_process,
    CAST(bc.computed_closing AS numeric(14,4)) AS computed_opening,
    CAST(bc.computed_closing + tsr.quantity + tsr.Received_From_process - tsr.Dispatch_To_process AS numeric(14,4)) AS computed_closing
  FROM temp_stock_register tsr
  JOIN balance_chain bc
    ON tsr.item_id = bc.item_id
   AND tsr.entry_date = bc.entry_date + INTERVAL '1 day'
)
UPDATE temp_stock_register tsr
SET opening_balance = bc.computed_opening,
    closing_balance = bc.computed_closing
FROM balance_chain bc
WHERE tsr.id = bc.id;

          UPDATE stock_register sr
          SET opening_balance = tsr.opening_balance,
              closing_balance = tsr.closing_balance
          FROM temp_stock_register tsr
          WHERE sr.id = tsr.id;
         
          INSERT INTO consolidated_stock_register (
              item_id, total_purchase, total_sales, total_sale_return, total_purchase_return,
              total_quantity, total_closing_balance, total_dispatch_to_process, total_received_from_process,
              user_id, financial_year
          )
          SELECT 
              sr.item_id,
              SUM(sr.purchase),
              SUM(sr.sales),
              SUM(sr.sale_return),
              SUM(sr.purchase_return),
              SUM(sr.quantity),
              (
                  SELECT closing_balance
                  FROM stock_register
                  WHERE user_id = p_user_id AND financial_year = p_financial_year AND item_id = sr.item_id
                  ORDER BY entry_date DESC
                  LIMIT 1
              ) AS total_closing_balance,
              SUM(sr.Dispatch_To_process),
              SUM(sr.Received_From_process),
              p_user_id,
              p_financial_year
          FROM stock_register sr
          WHERE sr.user_id = p_user_id AND sr.financial_year = p_financial_year
          GROUP BY sr.item_id
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
