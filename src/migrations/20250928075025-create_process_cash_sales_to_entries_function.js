'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
CREATE OR REPLACE PROCEDURE public.process_cash_sales_to_entries(IN p_user_id integer, IN p_financial_year character varying)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
  sale RECORD;
  summary_id_var INTEGER;
  summary RECORD;
  account RECORD;
  cash_account RECORD;
  transaction_id_var TEXT;
BEGIN
  -- Step 1: Aggregate only unlinked entries
CREATE TEMP TABLE temp_combined (
  entry_date DATE,
  account_id INT,
  total_amount NUMERIC
) ON COMMIT DROP;

INSERT INTO temp_combined
SELECT e.entry_date::date, e.category_account_id,
       SUM(CAST(e.value AS FLOAT)) AS total_amount
FROM cash_sale_entries e
WHERE e.user_id = p_user_id AND e.financial_year = p_financial_year
  AND NOT EXISTS (
    SELECT 1 FROM cash_sale_entry_links l WHERE l.cash_sale_entry_id = e.id
  )
GROUP BY e.entry_date::date, e.category_account_id

UNION ALL

SELECT e.entry_date::date, fm.account_id,
       SUM(CAST(ef.field_value AS FLOAT)) AS total_amount
FROM cash_sale_entries e
JOIN cash_entry_fields ef ON e.id = ef.cash_sale_entry_id
JOIN fields_mapping fm ON ef.field_id = fm.field_id AND fm.category_id = e.category_id
WHERE fm.account_id IS NOT NULL AND e.user_id = p_user_id AND e.financial_year = p_financial_year
  AND NOT EXISTS (
    SELECT 1 FROM cash_sale_entry_links l WHERE l.cash_sale_entry_id = e.id
  )
GROUP BY e.entry_date::date, fm.account_id;


  -- Step 2: Upsert summaries
INSERT INTO daily_cash_entry_summary (entry_date, account_id, total_amount, user_id, financial_year)
SELECT entry_date, account_id, total_amount, p_user_id, p_financial_year
FROM temp_combined
  ON CONFLICT (entry_date, account_id, user_id, financial_year)
  DO UPDATE SET total_amount = daily_cash_entry_summary.total_amount + EXCLUDED.total_amount;

  -- Step 3: Link only unlinked entries to summaries
  FOR sale IN
    SELECT id AS cash_sale_entry_id, entry_date::date AS entry_date, category_account_id AS account_id
    FROM cash_sale_entries
    WHERE user_id = p_user_id AND financial_year = p_financial_year
      AND NOT EXISTS (
        SELECT 1 FROM cash_sale_entry_links l WHERE l.cash_sale_entry_id = cash_sale_entries.id
      )
  LOOP
    SELECT id INTO summary_id_var
    FROM daily_cash_entry_summary
    WHERE entry_date = sale.entry_date AND account_id = sale.account_id
      AND user_id = p_user_id AND financial_year = p_financial_year;

    INSERT INTO cash_sale_entry_links (cash_sale_entry_id, summary_id)
    VALUES (sale.cash_sale_entry_id, summary_id_var);
  END LOOP;

FOR sale IN
  SELECT e.id AS cash_sale_entry_id, e.entry_date::date AS entry_date, fm.account_id
  FROM cash_sale_entries e
  JOIN cash_entry_fields ef ON e.id = ef.cash_sale_entry_id
  JOIN fields_mapping fm ON ef.field_id = fm.field_id AND fm.category_id = e.category_id
  WHERE fm.account_id IS NOT NULL
    AND e.user_id = p_user_id
    AND e.financial_year = p_financial_year
LOOP
  SELECT id INTO summary_id_var
  FROM daily_cash_entry_summary
  WHERE entry_date = sale.entry_date
    AND account_id = sale.account_id
    AND user_id = p_user_id
    AND financial_year = p_financial_year;

  -- Only insert if this exact link doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM cash_sale_entry_links
    WHERE cash_sale_entry_id = sale.cash_sale_entry_id
      AND summary_id = summary_id_var
  ) THEN
    INSERT INTO cash_sale_entry_links (cash_sale_entry_id, summary_id)
    VALUES (sale.cash_sale_entry_id, summary_id_var);
  END IF;
END LOOP;

  -- Step 4: Insert ledger entries only for affected summaries
  FOR summary IN
    SELECT s.*
    FROM daily_cash_entry_summary s
    JOIN temp_combined t
      ON s.entry_date = t.entry_date AND s.account_id = t.account_id
    WHERE s.user_id = p_user_id AND s.financial_year = p_financial_year
  LOOP
    transaction_id_var := CONCAT('TXN-', summary.entry_date, '-', summary.account_id);

    SELECT a.*, ag.group_id INTO account
    FROM account_list a
    JOIN account_group ag ON ag.account_id = a.id
    WHERE a.id = summary.account_id;

    INSERT INTO cash_entries (
      cash_date, narration, account_id, "type", amount,
      user_id, financial_year, transaction_id, group_id, is_cash_adjustment
    )
    VALUES (
      (summary.entry_date::timestamp + interval '5 hours 30 minutes') AT TIME ZONE 'Asia/Kolkata',
      CONCAT('Aggregated ', account.name, ' for ', summary.entry_date),
      summary.account_id,
      TRUE,
      summary.total_amount,
      p_user_id,
      p_financial_year,
      transaction_id_var,
      account.group_id,
      FALSE
    )
    ON CONFLICT (transaction_id, user_id, financial_year, is_cash_adjustment)
    DO UPDATE SET amount = EXCLUDED.amount;

    SELECT a.*, ag.group_id INTO cash_account
    FROM account_list a
    JOIN account_group ag ON ag.account_id = a.id
    WHERE a.name = 'CASH' AND a.user_id = p_user_id AND a.financial_year = p_financial_year;

    INSERT INTO cash_entries (
      cash_date, narration, account_id, "type", amount,
      user_id, financial_year, transaction_id, group_id, is_cash_adjustment
    )
    VALUES (
      (summary.entry_date::timestamp + interval '5 hours 30 minutes') AT TIME ZONE 'Asia/Kolkata',
      CONCAT('CASH entry for ', account.name, ' for ', summary.entry_date),
      cash_account.id,
      FALSE,
      summary.total_amount,
      p_user_id,
      p_financial_year,
      transaction_id_var,
      cash_account.group_id,
      TRUE
    )
    ON CONFLICT (transaction_id, user_id, financial_year, is_cash_adjustment)
    DO UPDATE SET amount = EXCLUDED.amount;
  END LOOP;
END;
$procedure$
;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP PROCEDURE IF EXISTS process_cash_sales_to_entries(INTEGER, VARCHAR);
    `);
  }
};
