'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE PROCEDURE public.populate_temp_stock_ledger(
        IN p_user_id integer,
        IN p_financial_year text,
        IN p_start_date date,
        IN p_end_date date
      )
      LANGUAGE plpgsql
      AS $procedure$
      DECLARE
          v_fin_year_start DATE := TO_DATE(SPLIT_PART(p_financial_year, '-', 1) || '-04-01', 'YYYY-MM-DD');
          outflow RECORD;
          inflow RECORD;
          consume_qty NUMERIC;
      BEGIN
          RAISE NOTICE 'Start Date: %, End Date: %', p_start_date, p_end_date;

          CREATE TEMP TABLE temp_stock_ledger (
              batch_id UUID,
              item_id INT,
              user_id INT,
              financial_year TEXT,
              batch_date DATE,
              rate NUMERIC,
              original_qty NUMERIC,
              remaining_qty NUMERIC,
              source_type TEXT,
              source_ref_id INT,
              direction TEXT
          );

          -- Insert inflow records
          INSERT INTO temp_stock_ledger
          SELECT gen_random_uuid(), item_id, user_id, financial_year,
                 v_fin_year_start, rate, quantity, quantity,
                 'opening_stock', NULL, 'in'
          FROM opening_stock
          WHERE user_id = p_user_id AND financial_year = p_financial_year;

          INSERT INTO temp_stock_ledger
          SELECT gen_random_uuid(), item_id, user_id, financial_year,
                 entry_date::date, unit_price, quantity, quantity,
                 'purchase', id, 'in'
          FROM entries
          WHERE type = 1 AND user_id = p_user_id AND financial_year = p_financial_year
            AND entry_date::date BETWEEN v_fin_year_start AND p_end_date;

          INSERT INTO temp_stock_ledger
          SELECT gen_random_uuid(), item_id, user_id, financial_year,
                 entry_date::date, unit_price, quantity, quantity,
                 'sale_return', id, 'in'
          FROM entries
          WHERE type = 4 AND user_id = p_user_id AND financial_year = p_financial_year
            AND entry_date::date BETWEEN v_fin_year_start AND p_end_date;

          INSERT INTO temp_stock_ledger
          SELECT gen_random_uuid(), item_id, user_id, financial_year,
                 production_date::date, NULL, quantity, quantity,
                 'received_from_process', id, 'in'
          FROM production_entries
          WHERE production_entry_id IS NOT NULL AND user_id = p_user_id
            AND financial_year = p_financial_year AND production_date BETWEEN v_fin_year_start AND p_end_date;

          -- Insert outflow records
          INSERT INTO temp_stock_ledger
          SELECT gen_random_uuid(), item_id, user_id, financial_year,
                 entry_date::date, unit_price, quantity, 0,
                 'sale', id, 'out'
          FROM entries
          WHERE type = 2 AND user_id = p_user_id AND financial_year = p_financial_year
            AND entry_date::date BETWEEN v_fin_year_start AND p_end_date;

          INSERT INTO temp_stock_ledger
          SELECT gen_random_uuid(), item_id, user_id, financial_year,
                 entry_date::date, unit_price, quantity, 0,
                 'purchase_return', id, 'out'
          FROM entries
          WHERE type = 3 AND user_id = p_user_id AND financial_year = p_financial_year
            AND entry_date::date BETWEEN v_fin_year_start AND p_end_date;

          INSERT INTO temp_stock_ledger
          SELECT gen_random_uuid(), raw_item_id, user_id, financial_year,
                 production_date::date, NULL, quantity, 0,
                 'dispatch_to_process', id, 'out'
          FROM production_entries
          WHERE production_entry_id IS NULL AND user_id = p_user_id
            AND financial_year = p_financial_year AND production_date BETWEEN v_fin_year_start AND p_end_date;

          -- FIFO consumption logic
          FOR outflow IN
              SELECT item_id, user_id, financial_year, batch_date, original_qty as qty, rate
              FROM temp_stock_ledger
              WHERE direction = 'out'
              ORDER BY batch_date, batch_id
          LOOP
              FOR inflow IN
                  SELECT batch_id, remaining_qty, rate
                  FROM temp_stock_ledger
                  WHERE direction = 'in'
                    AND item_id = outflow.item_id
                    AND user_id = outflow.user_id
                    AND financial_year = outflow.financial_year
                    AND remaining_qty > 0
                  ORDER BY batch_date, batch_id
              LOOP
                  EXIT WHEN outflow.qty <= 0;

                  consume_qty := LEAST(outflow.qty, inflow.remaining_qty);

                  UPDATE temp_stock_ledger
                  SET remaining_qty = remaining_qty - consume_qty
                  WHERE batch_id = inflow.batch_id;

                  outflow.qty := outflow.qty - consume_qty;
              END LOOP;
          END LOOP;

          -- Average sale rate for process receipts
          CREATE TEMP TABLE temp_sale_rates AS
          SELECT item_id,
                 SUM(rate * original_qty) / NULLIF(SUM(original_qty), 0) AS avg_sale_rate
          FROM temp_stock_ledger
          WHERE source_type = 'sale'
          GROUP BY item_id;

          UPDATE temp_stock_ledger sl
          SET rate = sr.avg_sale_rate
          FROM temp_sale_rates sr
          WHERE sl.rate IS NULL
            AND sl.source_type = 'received_from_process'
            AND sl.item_id = sr.item_id;

          -- FIFO valuation logic
          WITH fifo_batches AS (
              SELECT item_id, rate, remaining_qty, batch_date,
                     SUM(remaining_qty) OVER (PARTITION BY item_id ORDER BY batch_date) AS cumulative_qty
              FROM temp_stock_ledger
              WHERE direction = 'in'
          ),
          eligible_batches AS (
              SELECT fb.item_id, fb.rate, fb.remaining_qty, fb.cumulative_qty, sr.closing_balance,
                     CASE
                       WHEN sr.closing_balance <= 0 THEN sr.closing_balance
                       WHEN fb.cumulative_qty <= sr.closing_balance THEN fb.remaining_qty
                       ELSE sr.closing_balance - (fb.cumulative_qty - fb.remaining_qty)
                     END AS qty_to_value
              FROM fifo_batches fb
              JOIN (
                  SELECT item_id, closing_balance
                  FROM stock_register
                  WHERE user_id = p_user_id
                    AND financial_year = p_financial_year
                    AND entry_date = p_end_date
              ) sr ON sr.item_id = fb.item_id
          ),
          negative_rates AS (
              SELECT item_id,
                     closing_balance,
                     (
                       SELECT rate
                       FROM fifo_batches
                       WHERE item_id = sr.item_id
                       ORDER BY batch_date DESC, rate DESC
                       LIMIT 1
                     ) AS rate
              FROM stock_register sr
              WHERE user_id = p_user_id
                AND financial_year = p_financial_year
                AND entry_date = p_end_date
                AND closing_balance < 0
          )

          INSERT INTO closing_stock_valuation (
              item_id, user_id, financial_year, start_date, end_date, value
          )
          SELECT eb.item_id, p_user_id, p_financial_year, p_start_date, p_end_date,
                 CASE
                   WHEN eb.closing_balance < 0 THEN nr.closing_balance * nr.rate
                   ELSE SUM(eb.qty_to_value * eb.rate)
                 END AS value
          FROM eligible_batches eb
          LEFT JOIN negative_rates nr ON eb.item_id = nr.item_id
          GROUP BY eb.item_id, eb.closing_balance, nr.rate, nr.closing_balance;
      END;
      $procedure$;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE PROCEDURE populate_temp_stock_ledger(
    IN p_user_id INT,
    IN p_financial_year TEXT,
    IN p_start_date DATE,
    IN p_end_date DATE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_fin_year_start DATE := TO_DATE(SPLIT_PART(p_financial_year, '-', 1) || '-04-01', 'YYYY-MM-DD');
    outflow RECORD;
    inflow RECORD;
    consume_qty NUMERIC;
BEGIN
    CREATE TEMP TABLE temp_stock_ledger (
        batch_id UUID,
        item_id INT,
        user_id INT,
        financial_year TEXT,
        batch_date DATE,
        rate NUMERIC,
        original_qty NUMERIC,
        remaining_qty NUMERIC,
        source_type TEXT,
        source_ref_id INT,
        direction TEXT
    );

    -- Insert inflow records
    INSERT INTO temp_stock_ledger
    SELECT gen_random_uuid(), item_id, user_id, financial_year,
           v_fin_year_start, rate, quantity, quantity,
           'opening_stock', NULL, 'in'
    FROM opening_stock
    WHERE user_id = p_user_id AND financial_year = p_financial_year;

    INSERT INTO temp_stock_ledger
    SELECT gen_random_uuid(), item_id, user_id, financial_year,
           entry_date::date, unit_price, quantity, quantity,
           'purchase', id, 'in'
    FROM entries
    WHERE type = 1 AND user_id = p_user_id AND financial_year = p_financial_year
      AND entry_date BETWEEN v_fin_year_start AND p_end_date;

    INSERT INTO temp_stock_ledger
    SELECT gen_random_uuid(), item_id, user_id, financial_year,
           entry_date::date, unit_price, quantity, quantity,
           'sale_return', id, 'in'
    FROM entries
    WHERE type = 4 AND user_id = p_user_id AND financial_year = p_financial_year
      AND entry_date BETWEEN v_fin_year_start AND p_end_date;

    INSERT INTO temp_stock_ledger
    SELECT gen_random_uuid(), item_id, user_id, financial_year,
           production_date::date, NULL, quantity, quantity,
           'received_from_process', id, 'in'
    FROM production_entries
    WHERE production_entry_id IS NOT NULL AND user_id = p_user_id
      AND financial_year = p_financial_year AND production_date BETWEEN v_fin_year_start AND p_end_date;

    -- Insert outflow records
    INSERT INTO temp_stock_ledger
    SELECT gen_random_uuid(), item_id, user_id, financial_year,
           entry_date::date, unit_price, quantity, 0,
           'sale', id, 'out'
    FROM entries
    WHERE type = 2 AND user_id = p_user_id AND financial_year = p_financial_year
      AND entry_date BETWEEN v_fin_year_start AND p_end_date;

    INSERT INTO temp_stock_ledger
    SELECT gen_random_uuid(), item_id, user_id, financial_year,
           entry_date::date, unit_price, quantity, 0,
           'purchase_return', id, 'out'
    FROM entries
    WHERE type = 3 AND user_id = p_user_id AND financial_year = p_financial_year
      AND entry_date BETWEEN v_fin_year_start AND p_end_date;

    INSERT INTO temp_stock_ledger
    SELECT gen_random_uuid(), raw_item_id, user_id, financial_year,
           production_date::date, NULL, quantity, 0,
           'dispatch_to_process', id, 'out'
    FROM production_entries
    WHERE production_entry_id IS NULL AND user_id = p_user_id
      AND financial_year = p_financial_year AND production_date BETWEEN v_fin_year_start AND p_end_date;

    -- FIFO consumption logic
    FOR outflow IN
        SELECT item_id, user_id, financial_year, batch_date, original_qty as qty, rate
        FROM temp_stock_ledger
        WHERE direction = 'out'
        ORDER BY batch_date, batch_id
    LOOP
        FOR inflow IN
            SELECT batch_id, remaining_qty, rate
            FROM temp_stock_ledger
            WHERE direction = 'in'
              AND item_id = outflow.item_id
              AND user_id = outflow.user_id
              AND financial_year = outflow.financial_year
              AND remaining_qty > 0
            ORDER BY batch_date, batch_id
        LOOP
            EXIT WHEN outflow.qty <= 0;

            consume_qty := LEAST(outflow.qty, inflow.remaining_qty);

            UPDATE temp_stock_ledger
            SET rate = COALESCE(rate, outflow.rate),
                remaining_qty = remaining_qty - consume_qty
            WHERE batch_id = inflow.batch_id;

            outflow.qty := outflow.qty - consume_qty;
        END LOOP;
    END LOOP;

    -- Average sale rate for process receipts
    CREATE TEMP TABLE temp_sale_rates AS
    SELECT item_id,
           SUM(rate * original_qty) / NULLIF(SUM(original_qty), 0) AS avg_sale_rate
    FROM temp_stock_ledger
    WHERE source_type = 'sale'
    GROUP BY item_id;

    UPDATE temp_stock_ledger sl
    SET rate = sr.avg_sale_rate
    FROM temp_sale_rates sr
    WHERE sl.rate IS NULL
      AND sl.source_type = 'received_from_process'
      AND sl.item_id = sr.item_id;

    -- Final closing stock valuation
    WITH fifo_batches AS (
        SELECT item_id, rate, remaining_qty, batch_date,
               SUM(remaining_qty) OVER (PARTITION BY item_id ORDER BY batch_date) AS cumulative_qty
        FROM temp_stock_ledger
        WHERE direction = 'in'
    ),
    eligible_batches AS (
        SELECT fb.item_id, fb.rate, fb.remaining_qty, fb.cumulative_qty, sr.closing_balance,
               CASE
                 WHEN fb.cumulative_qty <= sr.closing_balance THEN fb.remaining_qty
                 ELSE sr.closing_balance - (fb.cumulative_qty - fb.remaining_qty)
               END AS qty_to_value
        FROM fifo_batches fb
        JOIN (
            SELECT item_id, closing_balance
            FROM stock_register
            WHERE user_id = p_user_id
              AND financial_year = p_financial_year
              AND entry_date = p_end_date
        ) sr ON sr.item_id = fb.item_id
        WHERE fb.cumulative_qty - fb.remaining_qty < sr.closing_balance
    )
    INSERT INTO closing_stock_valuation (
        item_id, user_id, financial_year, start_date, end_date, value
    )
    SELECT item_id, p_user_id, p_financial_year, p_start_date, p_end_date,
           SUM(qty_to_value * rate) AS value
    FROM eligible_batches
    GROUP BY item_id;
END;
$$;
    `);
  }
};
