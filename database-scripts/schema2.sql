--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: archive_old_partitions(); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.archive_old_partitions()
    LANGUAGE plpgsql
    AS $$
      DECLARE
          partition_name TEXT;
          main_partition_name TEXT;
      BEGIN
          -- Ensure the archive schema exists
          EXECUTE 'CREATE SCHEMA IF NOT EXISTS archive';

          -- Archive sub-partition tables first
          FOR partition_name IN
              SELECT tablename
              FROM pg_tables
              WHERE schemaname = 'public'
                AND tablename LIKE 'stock_register_%_%'
                AND substring(tablename, 16, 9) < to_char(current_date - INTERVAL '2 years', 'YYYY_YYYY')
          LOOP
              EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive', partition_name);
          END LOOP;

          -- Archive main partition tables next
          FOR main_partition_name IN
              SELECT tablename
              FROM pg_tables
              WHERE schemaname = 'public'
                AND tablename LIKE 'stock_register_%'
                AND tablename NOT LIKE 'stock_register_%_%'
                AND substring(tablename, 16, 9) < to_char(current_date - INTERVAL '2 years', 'YYYY_YYYY')
          LOOP
              EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive', main_partition_name);
          END LOOP;
      END;
      $$;


ALTER PROCEDURE public.archive_old_partitions() OWNER TO postgres;

--
-- Name: generate_stock_register(integer, integer, text); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.generate_stock_register(IN p_item_id integer, IN p_user_id integer, IN p_financial_year text)
    LANGUAGE plpgsql
    AS $$
        DECLARE
            rec RECORD;
            partition_name TEXT;
            main_partition_name TEXT;
        BEGIN
            RAISE NOTICE 'Starting procedure with parameters: %, %, %', p_item_id, p_user_id, p_financial_year;
  
            partition_name := format('stock_register_%s_%s', replace(p_financial_year, '-', '_'), p_user_id);
            main_partition_name := format('stock_register_%s', replace(p_financial_year, '-', '_'));
  
            RAISE NOTICE 'Partition names set: %, %', partition_name, main_partition_name;
  
            -- Acquire a lock on the stock_register table for the specific user and financial year
            PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || p_financial_year));
            RAISE NOTICE 'Acquired advisory lock';
  
            -- Check if the main partition exists in the archive schema and restore it if necessary
            IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'archive' AND tablename = main_partition_name) THEN
                EXECUTE format('ALTER TABLE archive.%I SET SCHEMA public', main_partition_name);
                RAISE NOTICE 'Restored main partition from archive: %', main_partition_name;
            END IF;
  
            -- Check if the sub-partition exists in the archive schema and restore it if necessary
            IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'archive' AND tablename = partition_name) THEN
                EXECUTE format('ALTER TABLE archive.%I SET SCHEMA public', partition_name);
                RAISE NOTICE 'Restored sub-partition from archive: %', partition_name;
            END IF;
  
            -- Create the main partition if it doesn't exist
            BEGIN
                EXECUTE format('
                    CREATE TABLE IF NOT EXISTS public.stock_register_%s PARTITION OF public.stock_register
                    FOR VALUES IN (%L)
                    PARTITION BY LIST (user_id)',
                    replace(p_financial_year, '-', '_'), p_financial_year
                );
                RAISE NOTICE 'Created main partition: %', main_partition_name;
            EXCEPTION
                WHEN others THEN
                    RAISE NOTICE 'Error creating partition for financial year %: %', p_financial_year, SQLERRM;
            END;
  
            -- Create the sub-partition if it doesn't exist
            BEGIN
                EXECUTE format('
                    CREATE TABLE IF NOT EXISTS public.stock_register_%s_%s PARTITION OF public.stock_register_%s
                    FOR VALUES IN (%L)',
                    replace(p_financial_year, '-', '_'), p_user_id, replace(p_financial_year, '-', '_'), p_user_id
                );
                RAISE NOTICE 'Created sub-partition: %', partition_name;
            EXCEPTION
                WHEN others THEN
                    RAISE NOTICE 'Error creating sub-partition for user % in financial year %: %', p_user_id, p_financial_year, SQLERRM;
            END;
  
            -- Create a temporary table for the financial year dates
            RAISE NOTICE 'Creating temporary date_range table';
            DROP TABLE IF EXISTS date_range;
            CREATE TEMP TABLE date_range AS
            SELECT generate_series(
                (substring(p_financial_year from 1 for 4) || '-04-01')::date,
                (substring(p_financial_year from 6 for 4) || '-03-31')::date,
                '1 day'::interval
            ) AS entry_date;
            RAISE NOTICE 'Temporary date_range table created';
  
            -- Insert or update aggregated data into the stock_register table
            RAISE NOTICE 'Inserting or updating aggregated data into stock_register';
            WITH entries_data AS (
        SELECT i.id AS item_id, dr.entry_date::date AS entry_date, 
                       COALESCE(SUM(
                           CASE 
                               WHEN e.type = 1 THEN e.quantity
                               ELSE 0
                           END
                       ), 0) AS purchase,
                       COALESCE(SUM(
                           CASE 
                               WHEN e.type = 2 THEN -e.quantity
                               ELSE 0
                           END
                       ), 0) AS sales,
                       COALESCE(SUM(
                           CASE 
                               WHEN e.type IN (4, 6) THEN e.quantity
                               ELSE 0
                           END
                       ), 0) AS sale_return,
                       COALESCE(SUM(
                           CASE 
                               WHEN e.type IN (3, 5) THEN -e.quantity
                               ELSE 0
                           END
                       ), 0) AS purchase_return,
                       COALESCE(SUM(
                           CASE 
                               WHEN e.type = 1 THEN e.quantity
                               WHEN e.type IN (2, 3, 5) THEN -e.quantity
                               WHEN e.type IN (4, 6) THEN e.quantity
                               ELSE 0
                           END
                       ), 0) AS quantity,
                       COALESCE(SUM(
                           CASE 
                               WHEN e.type = 1 THEN e.quantity
                               WHEN e.type IN (2, 3, 5) THEN -e.quantity
                               WHEN e.type IN (4, 6) THEN e.quantity
                               ELSE 0
                           END
                       ), 0) AS closing_balance,
                       p_financial_year AS financial_year,
                       p_user_id AS user_id
                FROM date_range dr
                LEFT JOIN public.items i ON i.id = p_item_id
        LEFT JOIN public.entries e ON dr.entry_date::date = e.entry_date::date AND e.item_id = i.id AND e.financial_year = p_financial_year AND e.user_id = p_user_id
        GROUP BY i.id, dr.entry_date::date
            ),
            production_data AS (
        SELECT i.id AS item_id, dr.entry_date::date AS entry_date, 
                       COALESCE(SUM(
                           CASE 
                               WHEN pe.production_entry_id IS NULL AND pe.raw_item_id = i.id THEN pe.quantity
                               ELSE 0
                           END
                       ), 0) AS Dispatch_To_process,
                       COALESCE(SUM(
                           CASE 
                               WHEN pe.production_entry_id IS NOT NULL AND pe.item_id = i.id THEN pe.quantity
                               ELSE 0
                           END
                       ), 0) AS Received_From_process
            FROM date_range dr
            LEFT JOIN public.items i ON i.id = p_item_id
        LEFT JOIN public.production_entries pe ON dr.entry_date::date = pe.production_date::date AND pe.financial_year = p_financial_year AND pe.user_id = p_user_id
        GROUP BY i.id, dr.entry_date::date
        )
        INSERT INTO public.stock_register (entry_id, production_entry_id, item_id, entry_date, opening_balance, quantity, closing_balance, entry_type, user_id, financial_year, Dispatch_To_process, Received_From_process, purchase, sales, sale_return, purchase_return)
        SELECT NULL, NULL, ed.item_id, ed.entry_date, 
               0 AS opening_balance,
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
        RAISE NOTICE 'Aggregated data inserted or updated';
  
        -- Create a temporary table to hold the updated balances
        RAISE NOTICE 'Creating temporary table temp_stock_register';
        DROP TABLE IF EXISTS temp_stock_register;
  CREATE TEMP TABLE temp_stock_register AS
  SELECT * FROM public.stock_register
  WHERE user_id = p_user_id AND financial_year = p_financial_year;
  RAISE NOTICE 'Temporary table temp_stock_register created';
  
  -- Update the opening_balance and closing_balance for each day
  RAISE NOTICE 'Updating opening_balance and closing_balance for each day';
  FOR rec IN
      SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process
      FROM temp_stock_register
      ORDER BY item_id, entry_date
  LOOP
      UPDATE temp_stock_register
      SET opening_balance = COALESCE(
              (SELECT closing_balance
               FROM temp_stock_register
               WHERE item_id = rec.item_id
                 AND entry_date = rec.entry_date - INTERVAL '1 day'), 0),
          closing_balance = COALESCE(
              (SELECT closing_balance
               FROM temp_stock_register
               WHERE item_id = rec.item_id
                 AND entry_date = rec.entry_date - INTERVAL '1 day'), 0) + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
      WHERE id = rec.id;
      RAISE NOTICE 'Updated balances for item_id: %, entry_date: %', rec.item_id, rec.entry_date;
  END LOOP;
  
  -- Update the original stock_register table with the updated balances
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
               (SELECT closing_balance
                FROM public.stock_register
                WHERE user_id = p_user_id AND financial_year = p_financial_year AND item_id = p_item_id
                ORDER BY entry_date DESC
                LIMIT 1) AS total_closing_balance, -- Get the last day's closing balance
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

        $$;


ALTER PROCEDURE public.generate_stock_register(IN p_item_id integer, IN p_user_id integer, IN p_financial_year text) OWNER TO postgres;

--
-- Name: get_vacuum_schedule(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_vacuum_schedule() RETURNS TABLE(table_name text, schedule text)
    LANGUAGE plpgsql
    AS $$
      BEGIN
          RETURN QUERY
          SELECT relname AS table_name,
                 CASE
                     WHEN n_dead_tup > 10000 THEN 'daily'
                     WHEN n_dead_tup > 2000 THEN 'weekly'
                     ELSE 'monthly'
                 END AS schedule
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
            AND relname LIKE 'stock_register_%';
      END;
      $$;


ALTER FUNCTION public.get_vacuum_schedule() OWNER TO postgres;

--
-- Name: prune_old_partitions(); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.prune_old_partitions()
    LANGUAGE plpgsql
    AS $$
        DECLARE
            partition_name TEXT;
        BEGIN
            FOR partition_name IN
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'archive'
                  AND tablename LIKE 'stock_register_%'
                  AND substring(tablename from 15 for 4)::int < extract(year from current_date) - 10
            LOOP
                EXECUTE format('DROP TABLE IF EXISTS archive.%I', partition_name);
            END LOOP;
        END;
        $$;


ALTER PROCEDURE public.prune_old_partitions() OWNER TO postgres;

--
-- Name: reindex_active_tables(); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.reindex_active_tables()
    LANGUAGE plpgsql
    AS $$
        DECLARE
            table_name TEXT;
        BEGIN
            -- Reindex the most active dynamic tables
            FOR table_name IN
                SELECT relname
                FROM pg_stat_user_tables
                WHERE schemaname = 'public'
                ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC
                LIMIT 10 -- Adjust this limit based on your needs
            LOOP
                EXECUTE format('REINDEX TABLE public.%I', table_name);
            END LOOP;
  
            -- Reindex the most active partition tables
            FOR table_name IN
                SELECT relname
                FROM pg_stat_user_tables
                WHERE schemaname = 'public'
                  AND relname LIKE 'stock_register_%'
                ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC
                LIMIT 100 -- Adjust this limit based on your needs
            LOOP
                EXECUTE format('REINDEX TABLE public.%I', table_name);
            END LOOP;
        END;
        $$;


ALTER PROCEDURE public.reindex_active_tables() OWNER TO postgres;

--
-- Name: reindex_all_tables(); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.reindex_all_tables()
    LANGUAGE plpgsql
    AS $$
        DECLARE
            table_name TEXT;
        BEGIN
            FOR table_name IN
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
            LOOP
                EXECUTE format('REINDEX TABLE public.%I', table_name);
            END LOOP;
        END;
        $$;


ALTER PROCEDURE public.reindex_all_tables() OWNER TO postgres;

--
-- Name: schedule_vacuum_jobs(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.schedule_vacuum_jobs() RETURNS void
    LANGUAGE plpgsql
    AS $$
      DECLARE
          rec RECORD;
      BEGIN
          FOR rec IN SELECT * FROM get_vacuum_schedule() LOOP
              IF rec.schedule = 'daily' THEN
                  PERFORM cron.schedule('vacuum_' || rec.table_name, '0 3 * * *', 'VACUUM ANALYZE public.' || rec.table_name);
              ELSIF rec.schedule = 'weekly' THEN
                  PERFORM cron.schedule('vacuum_' || rec.table_name, '0 3 * * 0', 'VACUUM ANALYZE public.' || rec.table_name);
              ELSE
                  PERFORM cron.schedule('vacuum_' || rec.table_name, '0 3 1 * *', 'VACUUM ANALYZE public.' || rec.table_name);
              END IF;
          END LOOP;
      END;
      $$;


ALTER FUNCTION public.schedule_vacuum_jobs() OWNER TO postgres;

--
-- Name: update_balance(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_balance() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
                DECLARE
                  balance_record RECORD;
                  amount_diff DECIMAL(10, 2);
                BEGIN
                  -- Fetch the current balance record with row-level lock
                  IF TG_OP = 'DELETE' THEN
                    SELECT * INTO balance_record FROM balance WHERE user_id = OLD.user_id AND financial_year = OLD.financial_year FOR UPDATE;
                  ELSE
                    SELECT * INTO balance_record FROM balance WHERE user_id = NEW.user_id AND financial_year = NEW.financial_year FOR UPDATE;
                  END IF;
          
                  -- Calculate the amount difference based on the operation
                  IF TG_OP = 'INSERT' THEN
                    amount_diff := NEW.amount;
                  ELSIF TG_OP = 'UPDATE' THEN
                    amount_diff := NEW.amount - OLD.amount;
                  ELSIF TG_OP = 'DELETE' THEN
                    amount_diff := OLD.amount;
                  END IF;
          
                  -- Update the balance
                  IF TG_OP = 'DELETE' THEN
                    IF OLD.type THEN -- Credit
                      balance_record.amount := balance_record.amount - amount_diff;
                    ELSE -- Debit
                      balance_record.amount := balance_record.amount + amount_diff;
                    END IF;
                  ELSE
                    IF NEW.type THEN -- Credit
                      balance_record.amount := balance_record.amount + amount_diff;
                    ELSE -- Debit
                      balance_record.amount := balance_record.amount - amount_diff;
                    END IF;
                  END IF;
          
                  -- Save the updated balance
                  UPDATE balance SET amount = balance_record.amount WHERE id = balance_record.id;
          
                  RETURN NEW;
                END;
                $$;


ALTER FUNCTION public.update_balance() OWNER TO postgres;

--
-- Name: update_stock_register_from_entries_on_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_stock_register_from_entries_on_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        DECLARE
            rec RECORD;
            stock_exists BOOLEAN;
            old_stock_exists BOOLEAN;
            open_bal NUMERIC; -- Declare a variable for open_bal
        BEGIN
            -- Add a RAISE NOTICE statement to check if the trigger is working
            RAISE NOTICE 'Trigger update_stock_register_from_entries_on_delete is working';
  
            -- Check if stock_register data exists for the user_id, financial_year, and item_id
            SELECT EXISTS (
                SELECT 1
                FROM public.stock_register
                WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND financial_year = COALESCE(NEW.financial_year, OLD.financial_year) AND item_id = COALESCE(NEW.item_id, OLD.item_id)
            ) INTO stock_exists;
  
            -- If stock_register data does not exist, call generate_stock_register to initialize the data
            IF NOT stock_exists THEN
                CALL generate_stock_register(COALESCE(NEW.item_id, OLD.item_id), COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.financial_year, OLD.financial_year));
                RETURN COALESCE(NEW); -- Skip the rest of the logic
            END IF;
  
            -- Handle deletion by updating the quantity and other fields
            UPDATE public.stock_register
            SET quantity = quantity - CASE 
                                        WHEN OLD.type = 1 THEN OLD.quantity 
                                        WHEN OLD.type = 2 THEN -OLD.quantity 
                                        WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                        WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                        ELSE 0 
                                      END,
                purchase = purchase - CASE WHEN OLD.type = 1 THEN OLD.quantity ELSE 0 END,
                sales = sales - CASE WHEN OLD.type = 2 THEN -OLD.quantity ELSE 0 END,
                sale_return = sale_return - CASE WHEN OLD.type IN (4, 6) THEN OLD.quantity ELSE 0 END,
                purchase_return = purchase_return - CASE WHEN OLD.type IN (3, 5) THEN -OLD.quantity ELSE 0 END,
                closing_balance = opening_balance + (quantity - CASE 
                                                                WHEN OLD.type = 1 THEN OLD.quantity 
                                                                WHEN OLD.type = 2 THEN -OLD.quantity 
                                                                WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                                WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                                ELSE 0 
                                                              END) + Received_From_process - Dispatch_To_process
            WHERE item_id = OLD.item_id AND entry_date::date = OLD.entry_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year;
  
            -- Update opening_balance and closing_balance for subsequent days
            FOR rec IN
                SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
                FROM public.stock_register
                WHERE item_id = OLD.item_id AND entry_date::date > OLD.entry_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year
                ORDER BY entry_date::date
            LOOP
                -- Fetch the closing_balance of the previous day
                SELECT COALESCE(closing_balance, 0)
                INTO open_bal
                FROM public.stock_register
                WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;
  
                -- Update the record with the new open_bal and closing_balance
                UPDATE public.stock_register
                SET opening_balance = open_bal,
                    closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
                WHERE id = rec.id;
            END LOOP;
  
            -- Update Consolidated Stock Register on Delete
            UPDATE public.consolidated_stock_register
            SET total_purchase = total_purchase - CASE WHEN OLD.type = 1 THEN OLD.quantity ELSE 0 END,
                total_sales = total_sales - CASE WHEN OLD.type = 2 THEN -OLD.quantity ELSE 0 END,
                total_sale_return = total_sale_return - CASE WHEN OLD.type IN (4, 6) THEN OLD.quantity ELSE 0 END,
                total_purchase_return = total_purchase_return - CASE WHEN OLD.type IN (3, 5) THEN -OLD.quantity ELSE 0 END,
                total_quantity = total_quantity - CASE 
                                                    WHEN OLD.type = 1 THEN OLD.quantity 
                                                    WHEN OLD.type = 2 THEN -OLD.quantity 
                                                    WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                    WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                    ELSE 0 
                                                  END,
                total_closing_balance = total_closing_balance - CASE 
                                                                  WHEN OLD.type = 1 THEN OLD.quantity 
                                                                  WHEN OLD.type = 2 THEN -OLD.quantity 
                                                                  WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                                  WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                                  ELSE 0 
                                                                END
            WHERE item_id = OLD.item_id AND user_id = OLD.user_id AND financial_year = OLD.financial_year;
  
            RETURN OLD;
        END;
        $$;


ALTER FUNCTION public.update_stock_register_from_entries_on_delete() OWNER TO postgres;

--
-- Name: update_stock_register_from_entries_on_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_stock_register_from_entries_on_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE
          rec RECORD;
          stock_exists BOOLEAN;
          old_stock_exists BOOLEAN;
          open_bal NUMERIC; -- Declare a variable for open_bal
      BEGIN
          -- Add a RAISE NOTICE statement to check if the trigger is working
          RAISE NOTICE 'Trigger update_stock_register_from_entries_on_insert is working';

          -- Check if stock_register data exists for the user_id, financial_year, and item_id
          SELECT EXISTS (
              SELECT 1
              FROM public.stock_register
              WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND financial_year = COALESCE(NEW.financial_year, OLD.financial_year) AND item_id = COALESCE(NEW.item_id, OLD.item_id)
          ) INTO stock_exists;

          -- If stock_register data does not exist, call generate_stock_register to initialize the data
          IF NOT stock_exists THEN
              CALL generate_stock_register(COALESCE(NEW.item_id, OLD.item_id), COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.financial_year, OLD.financial_year));
              RETURN COALESCE(NEW, OLD); -- Skip the rest of the logic
          END IF;
          -- Add NEW values
          INSERT INTO public.stock_register (entry_id, item_id, entry_date, opening_balance, quantity, closing_balance, entry_type, user_id, financial_year, purchase, sales, sale_return, purchase_return)
          VALUES (NEW.id, NEW.item_id, NEW.entry_date, 0, 
                  CASE 
                      WHEN NEW.type = 1 THEN NEW.quantity 
                      WHEN NEW.type = 2 THEN -NEW.quantity 
                      WHEN NEW.type IN (4, 6) THEN NEW.quantity 
                      WHEN NEW.type IN (3, 5) THEN -NEW.quantity 
                      ELSE 0 
                  END, 
                  0, 'Entry', NEW.user_id, NEW.financial_year, 
                  CASE WHEN NEW.type = 1 THEN NEW.quantity ELSE 0 END,
                  CASE WHEN NEW.type = 2 THEN -NEW.quantity ELSE 0 END,
                  CASE WHEN NEW.type IN (4, 6) THEN NEW.quantity ELSE 0 END,
                  CASE WHEN NEW.type IN (3, 5) THEN -NEW.quantity ELSE 0 END)
          ON CONFLICT (item_id, entry_date, user_id, financial_year) DO UPDATE
          SET quantity = stock_register.quantity + EXCLUDED.quantity,
              purchase = stock_register.purchase + EXCLUDED.purchase,
              sales = stock_register.sales + EXCLUDED.sales,
              sale_return = stock_register.sale_return + EXCLUDED.sale_return,
              purchase_return = stock_register.purchase_return + EXCLUDED.purchase_return;

          -- Update closing_balance for the specific entry date
          UPDATE public.stock_register
          SET closing_balance = opening_balance + quantity + Received_From_process - Dispatch_To_process
          WHERE item_id = NEW.item_id AND entry_date::date = NEW.entry_date::date AND user_id = NEW.user_id AND financial_year = NEW.financial_year;

          -- Update opening_balance and closing_balance for subsequent days
          FOR rec IN
              SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
              FROM public.stock_register
              WHERE item_id = NEW.item_id AND entry_date::date > NEW.entry_date::date AND user_id = NEW.user_id AND financial_year = NEW.financial_year
              ORDER BY entry_date::date
          LOOP
              -- Fetch the closing_balance of the previous day
              SELECT COALESCE(closing_balance, 0)
              INTO open_bal
              FROM public.stock_register
              WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;

              -- Update the record with the new open_bal and closing_balance
              UPDATE public.stock_register
              SET opening_balance = open_bal,
                  closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
              WHERE id = rec.id;
          END LOOP;

          -- Update consolidated_stock_register table
          UPDATE public.consolidated_stock_register
          SET total_purchase = total_purchase + CASE WHEN NEW.type = 1 THEN NEW.quantity ELSE 0 END,
              total_sales = total_sales + CASE WHEN NEW.type = 2 THEN -NEW.quantity ELSE 0 END,
              total_sale_return = total_sale_return + CASE WHEN NEW.type IN (4, 6) THEN NEW.quantity ELSE 0 END,
              total_purchase_return = total_purchase_return + CASE WHEN NEW.type IN (3, 5) THEN -NEW.quantity ELSE 0 END,
              total_quantity = total_quantity + CASE 
                                                  WHEN NEW.type = 1 THEN NEW.quantity 
                                                  WHEN NEW.type = 2 THEN -NEW.quantity 
                                                  WHEN NEW.type IN (4, 6) THEN NEW.quantity 
                                                  WHEN NEW.type IN (3, 5) THEN -NEW.quantity 
                                                  ELSE 0 
                                                END,
              total_closing_balance = total_closing_balance + CASE 
                                                                WHEN NEW.type = 1 THEN NEW.quantity 
                                                                WHEN NEW.type = 2 THEN -NEW.quantity 
                                                                WHEN NEW.type IN (4, 6) THEN NEW.quantity 
                                                                WHEN NEW.type IN (3, 5) THEN -NEW.quantity 
                                                                ELSE 0 
                                                              END
          WHERE item_id = NEW.item_id AND user_id = NEW.user_id AND financial_year = NEW.financial_year;

          RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.update_stock_register_from_entries_on_insert() OWNER TO postgres;

--
-- Name: update_stock_register_from_entries_on_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_stock_register_from_entries_on_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    rec RECORD;
    stock_exists BOOLEAN;
    old_stock_exists BOOLEAN;
    open_bal NUMERIC; -- Declare a variable for open_bal
begin
	    -- Add a RAISE NOTICE statement to check if the trigger is working
    RAISE NOTICE 'Trigger update_stock_register_from_entries_on_update is working';

    -- Check if stock_register data exists for the user_id, financial_year, and item_id
    SELECT EXISTS (
        SELECT 1
        FROM public.stock_register
        WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND financial_year = COALESCE(NEW.financial_year, OLD.financial_year) AND item_id = COALESCE(NEW.item_id, OLD.item_id)
    ) INTO stock_exists;

    -- If stock_register data does not exist, call generate_stock_register to initialize the data
    IF NOT stock_exists THEN
        CALL generate_stock_register(COALESCE(NEW.item_id, OLD.item_id), COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.financial_year, OLD.financial_year));
        IF OLD.item_id <> NEW.item_id THEN
            -- Check if stock_register data exists for the user_id, financial_year, and item_id
            SELECT EXISTS (
                SELECT 1
                FROM public.stock_register
                WHERE user_id = COALESCE(OLD.user_id, NEW.user_id) AND financial_year = COALESCE(OLD.financial_year, NEW.financial_year) AND item_id = COALESCE(OLD.item_id, NEW.item_id)
            ) INTO old_stock_exists;

            IF NOT old_stock_exists THEN
                CALL generate_stock_register(COALESCE(OLD.item_id, NEW.item_id), COALESCE(OLD.user_id, NEW.user_id), COALESCE(OLD.financial_year, NEW.financial_year));
                RETURN COALESCE(NEW, OLD); -- Skip the rest of the logic
            END IF;
        -- If entry_date or item_id is changed, handle it as a delete and insert
        -- Subtract OLD values
        UPDATE public.stock_register
        SET quantity = quantity - CASE 
                                    WHEN OLD.type = 1 THEN OLD.quantity 
                                    WHEN OLD.type = 2 THEN -OLD.quantity 
                                    WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                    WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                    ELSE 0 
                                  END,
            purchase = purchase - CASE WHEN OLD.type = 1 THEN OLD.quantity ELSE 0 END,
            sales = sales - CASE WHEN OLD.type = 2 THEN -OLD.quantity ELSE 0 END,
            sale_return = sale_return - CASE WHEN OLD.type IN (4, 6) THEN OLD.quantity ELSE 0 END,
            purchase_return = purchase_return - CASE WHEN OLD.type IN (3, 5) THEN -OLD.quantity ELSE 0 END,
            closing_balance = opening_balance + (quantity - CASE 
                                                            WHEN OLD.type = 1 THEN OLD.quantity 
                                                            WHEN OLD.type = 2 THEN -OLD.quantity 
                                                            WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                            WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                            ELSE 0 
                                                          END) + Received_From_process - Dispatch_To_process
        WHERE item_id = OLD.item_id AND entry_date::date = OLD.entry_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year;

        -- Update opening_balance and closing_balance for subsequent days
        FOR rec IN
            SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
            FROM public.stock_register
            WHERE item_id = OLD.item_id AND entry_date::date > OLD.entry_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year
            ORDER BY entry_date::date
        LOOP
            -- Fetch the closing_balance of the previous day
            SELECT COALESCE(closing_balance, 0)
            INTO open_bal
            FROM public.stock_register
            WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;

            -- Update the record with the new open_bal and closing_balance
            UPDATE public.stock_register
            SET opening_balance = open_bal,
                closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
            WHERE id = rec.id;
        END LOOP;

        -- Update consolidated_stock_register table
        UPDATE public.consolidated_stock_register
        SET total_purchase = total_purchase - CASE WHEN OLD.type = 1 THEN OLD.quantity ELSE 0 END,
            total_sales = total_sales - CASE WHEN OLD.type = 2 THEN -OLD.quantity ELSE 0 END,
            total_sale_return = total_sale_return - CASE WHEN OLD.type IN (4, 6) THEN OLD.quantity ELSE 0 END,
            total_purchase_return = total_purchase_return - CASE WHEN OLD.type IN (3, 5) THEN -OLD.quantity ELSE 0 END,
            total_quantity = total_quantity - CASE 
                                                WHEN OLD.type = 1 THEN OLD.quantity 
                                                WHEN OLD.type = 2 THEN -OLD.quantity 
                                                WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                ELSE 0 
                                              END,
            total_closing_balance = total_closing_balance - CASE 
                                                              WHEN OLD.type = 1 THEN OLD.quantity 
                                                              WHEN OLD.type = 2 THEN -OLD.quantity 
                                                              WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                              WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                              ELSE 0 
                                                            END
        WHERE item_id = OLD.item_id AND user_id = OLD.user_id AND financial_year = OLD.financial_year;
        END IF;
        RETURN COALESCE(NEW, OLD); -- Skip the rest of the logic
    END IF;
    IF OLD.item_id <> NEW.item_id THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.stock_register
            WHERE user_id = COALESCE(OLD.user_id, NEW.user_id) AND financial_year = COALESCE(OLD.financial_year, NEW.financial_year) AND item_id = COALESCE(OLD.item_id, NEW.item_id)
        ) INTO old_stock_exists;

        IF NOT old_stock_exists THEN
            CALL generate_stock_register(COALESCE(OLD.item_id, NEW.item_id), COALESCE(OLD.user_id, NEW.user_id), COALESCE(OLD.financial_year, NEW.financial_year));
            RETURN COALESCE(NEW, OLD); -- Skip the rest of the logic
        END IF;    
    END IF;

    -- Handle update by subtracting OLD values and adding NEW values
    IF OLD.entry_date <> NEW.entry_date OR OLD.item_id <> NEW.item_id THEN
        -- If entry_date or item_id is changed, handle it as a delete and insert
        -- Subtract OLD values
        UPDATE public.stock_register
        SET quantity = quantity - CASE 
                                    WHEN OLD.type = 1 THEN OLD.quantity 
                                    WHEN OLD.type = 2 THEN -OLD.quantity 
                                    WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                    WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                    ELSE 0 
                                  END,
            purchase = purchase - CASE WHEN OLD.type = 1 THEN OLD.quantity ELSE 0 END,
            sales = sales - CASE WHEN OLD.type = 2 THEN -OLD.quantity ELSE 0 END,
            sale_return = sale_return - CASE WHEN OLD.type IN (4, 6) THEN OLD.quantity ELSE 0 END,
            purchase_return = purchase_return - CASE WHEN OLD.type IN (3, 5) THEN -OLD.quantity ELSE 0 END,
            closing_balance = opening_balance + (quantity - CASE 
                                                            WHEN OLD.type = 1 THEN OLD.quantity 
                                                            WHEN OLD.type = 2 THEN -OLD.quantity 
                                                            WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                            WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                            ELSE 0 
                                                          END) + Received_From_process - Dispatch_To_process
        WHERE item_id = OLD.item_id AND entry_date::date = OLD.entry_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year;

        -- Update opening_balance and closing_balance for subsequent days
        FOR rec IN
            SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
            FROM public.stock_register
            WHERE item_id = OLD.item_id AND entry_date::date > OLD.entry_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year
            ORDER BY entry_date::date
        LOOP
            -- Fetch the closing_balance of the previous day
            SELECT COALESCE(closing_balance, 0)
            INTO open_bal
            FROM public.stock_register
            WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;

            -- Update the record with the new open_bal and closing_balance
            UPDATE public.stock_register
            SET opening_balance = open_bal,
                closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
            WHERE id = rec.id;
        END LOOP;

        -- Update consolidated_stock_register table
        UPDATE public.consolidated_stock_register
        SET total_purchase = total_purchase - CASE WHEN OLD.type = 1 THEN OLD.quantity ELSE 0 END,
            total_sales = total_sales - CASE WHEN OLD.type = 2 THEN -OLD.quantity ELSE 0 END,
            total_sale_return = total_sale_return - CASE WHEN OLD.type IN (4, 6) THEN OLD.quantity ELSE 0 END,
            total_purchase_return = total_purchase_return - CASE WHEN OLD.type IN (3, 5) THEN -OLD.quantity ELSE 0 END,
            total_quantity = total_quantity - CASE 
                                                WHEN OLD.type = 1 THEN OLD.quantity 
                                                WHEN OLD.type = 2 THEN -OLD.quantity 
                                                WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                ELSE 0 
                                              END,
            total_closing_balance = total_closing_balance - CASE 
                                                              WHEN OLD.type = 1 THEN OLD.quantity 
                                                              WHEN OLD.type = 2 THEN -OLD.quantity 
                                                              WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                              WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                              ELSE 0 
                                                            END
        WHERE item_id = OLD.item_id AND user_id = OLD.user_id AND financial_year = OLD.financial_year;

		-- Add NEW values
		INSERT INTO public.stock_register (entry_id, item_id, entry_date, opening_balance, quantity, closing_balance, entry_type, user_id, financial_year, purchase, sales, sale_return, purchase_return)
		VALUES (NEW.id, NEW.item_id, NEW.entry_date, 0, 
				CASE 
					WHEN NEW.type = 1 THEN NEW.quantity 
					WHEN NEW.type = 2 THEN -NEW.quantity 
					WHEN NEW.type IN (4, 6) THEN NEW.quantity 
					WHEN NEW.type IN (3, 5) THEN -NEW.quantity 
					ELSE 0 
				END, 
				0, 'Entry', NEW.user_id, NEW.financial_year, 
				CASE WHEN NEW.type = 1 THEN NEW.quantity ELSE 0 END,
				CASE WHEN NEW.type = 2 THEN -NEW.quantity ELSE 0 END,
				CASE WHEN NEW.type IN (4, 6) THEN NEW.quantity ELSE 0 END,
				CASE WHEN NEW.type IN (3, 5) THEN -NEW.quantity ELSE 0 END)
		ON CONFLICT (item_id, entry_date, user_id, financial_year) DO UPDATE
		SET quantity = stock_register.quantity + EXCLUDED.quantity,
			purchase = stock_register.purchase + EXCLUDED.purchase,
			sales = stock_register.sales + EXCLUDED.sales,
			sale_return = stock_register.sale_return + EXCLUDED.sale_return,
			purchase_return = stock_register.purchase_return + EXCLUDED.purchase_return;

		-- Update closing_balance for the specific entry date
		UPDATE public.stock_register
		SET closing_balance = opening_balance + quantity + Received_From_process - Dispatch_To_process
		WHERE item_id = NEW.item_id AND entry_date::date = NEW.entry_date::date AND user_id = NEW.user_id AND financial_year = NEW.financial_year;

		-- Update opening_balance and closing_balance for subsequent days
		FOR rec IN
			SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
			FROM public.stock_register
			WHERE item_id = NEW.item_id AND entry_date::date > NEW.entry_date::date AND user_id = NEW.user_id AND financial_year = NEW.financial_year
			ORDER BY entry_date::date
		LOOP
			-- Fetch the closing_balance of the previous day
			SELECT COALESCE(closing_balance, 0)
			INTO open_bal
			FROM public.stock_register
			WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;

			-- Update the record with the new open_bal and closing_balance
			UPDATE public.stock_register
			SET opening_balance = open_bal,
				closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
			WHERE id = rec.id;
		END LOOP;

		-- Update consolidated_stock_register table
		UPDATE public.consolidated_stock_register
		SET total_purchase = total_purchase + CASE WHEN NEW.type = 1 THEN NEW.quantity ELSE 0 END,
			total_sales = total_sales + CASE WHEN NEW.type = 2 THEN -NEW.quantity ELSE 0 END,
			total_sale_return = total_sale_return + CASE WHEN NEW.type IN (4, 6) THEN NEW.quantity ELSE 0 END,
			total_purchase_return = total_purchase_return + CASE WHEN NEW.type IN (3, 5) THEN -NEW.quantity ELSE 0 END,
			total_quantity = total_quantity + CASE 
												WHEN NEW.type = 1 THEN NEW.quantity 
												WHEN NEW.type = 2 THEN -NEW.quantity 
												WHEN NEW.type IN (4, 6) THEN NEW.quantity 
												WHEN NEW.type IN (3, 5) THEN -NEW.quantity 
												ELSE 0 
											  END,
			total_closing_balance = total_closing_balance + CASE 
															  WHEN NEW.type = 1 THEN NEW.quantity 
															  WHEN NEW.type = 2 THEN -NEW.quantity 
															  WHEN NEW.type IN (4, 6) THEN NEW.quantity 
															  WHEN NEW.type IN (3, 5) THEN -NEW.quantity 
															  ELSE 0 
															END
		WHERE item_id = NEW.item_id AND user_id = NEW.user_id AND financial_year = NEW.financial_year;

		RETURN NEW;
ELSE
    -- Handle update by subtracting OLD values and adding NEW values
    UPDATE public.stock_register
    SET quantity = quantity - CASE 
                                WHEN OLD.type = 1 THEN OLD.quantity 
                                WHEN OLD.type = 2 THEN -OLD.quantity 
                                WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                ELSE 0 
                              END + CASE 
                                      WHEN NEW.type = 1 THEN NEW.quantity 
                                      WHEN NEW.type = 2 THEN -NEW.quantity 
                                      WHEN NEW.type IN (4, 6) THEN NEW.quantity 
                                      WHEN NEW.type IN (3, 5) THEN -NEW.quantity 
                                      ELSE 0 
                                    END,
        purchase = purchase - CASE WHEN OLD.type = 1 THEN OLD.quantity ELSE 0 END + CASE WHEN NEW.type = 1 THEN NEW.quantity ELSE 0 END,
        sales = sales - CASE WHEN OLD.type = 2 THEN -OLD.quantity ELSE 0 END + CASE WHEN NEW.type = 2 THEN -NEW.quantity ELSE 0 END,
        sale_return = sale_return - CASE WHEN OLD.type IN (4, 6) THEN OLD.quantity ELSE 0 END + CASE WHEN NEW.type IN (4, 6) THEN NEW.quantity ELSE 0 END,
        purchase_return = purchase_return - CASE WHEN OLD.type IN (3, 5) THEN -OLD.quantity ELSE 0 END + CASE WHEN NEW.type IN (3, 5) THEN -NEW.quantity ELSE 0 END,
        closing_balance = opening_balance + (quantity - CASE 
                                                        WHEN OLD.type = 1 THEN OLD.quantity 
                                                        WHEN OLD.type = 2 THEN -OLD.quantity 
                                                        WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                        WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                        ELSE 0 
                                                      END + CASE 
                                                              WHEN NEW.type = 1 THEN NEW.quantity 
                                                              WHEN NEW.type = 2 THEN -NEW.quantity 
                                                              WHEN NEW.type IN (4, 6) THEN NEW.quantity 
                                                              WHEN NEW.type IN (3, 5) THEN -NEW.quantity 
                                                              ELSE 0 
                                                            END) + Received_From_process - Dispatch_To_process
    WHERE item_id = NEW.item_id AND entry_date::date = NEW.entry_date::date AND user_id = NEW.user_id AND financial_year = NEW.financial_year;

    -- Update opening_balance and closing_balance for subsequent days
    FOR rec IN
        SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
        FROM public.stock_register
        WHERE item_id = NEW.item_id AND entry_date::date > NEW.entry_date::date AND user_id = NEW.user_id AND financial_year = NEW.financial_year
        ORDER BY entry_date::date
    LOOP
        -- Fetch the closing_balance of the previous day
        SELECT COALESCE(closing_balance, 0)
        INTO open_bal
        FROM public.stock_register
        WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;

        -- Update the record with the new open_bal and closing_balance
        UPDATE public.stock_register
        SET opening_balance = open_bal,
            closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
        WHERE id = rec.id;
    END LOOP;

    -- Update consolidated_stock_register table
    UPDATE public.consolidated_stock_register
    SET total_purchase = total_purchase - CASE WHEN OLD.type = 1 THEN OLD.quantity ELSE 0 END + CASE WHEN NEW.type = 1 THEN NEW.quantity ELSE 0 END,
        total_sales = total_sales - CASE WHEN OLD.type = 2 THEN -OLD.quantity ELSE 0 END + CASE WHEN NEW.type = 2 THEN -NEW.quantity ELSE 0 END,
        total_sale_return = total_sale_return - CASE WHEN OLD.type IN (4, 6) THEN OLD.quantity ELSE 0 END + CASE WHEN NEW.type IN (4, 6) THEN NEW.quantity ELSE 0 END,
        total_purchase_return = total_purchase_return - CASE WHEN OLD.type IN (3, 5) THEN -OLD.quantity ELSE 0 END + CASE WHEN NEW.type IN (3, 5) THEN -NEW.quantity ELSE 0 END,
        total_quantity = total_quantity - CASE 
                                            WHEN OLD.type = 1 THEN OLD.quantity 
                                            WHEN OLD.type = 2 THEN -OLD.quantity 
                                            WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                            WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                            ELSE 0 
                                          END + CASE 
                                                  WHEN NEW.type = 1 THEN NEW.quantity 
                                                  WHEN NEW.type = 2 THEN -NEW.quantity 
                                                  WHEN NEW.type IN (4, 6) THEN NEW.quantity 
                                                  WHEN NEW.type IN (3, 5) THEN -NEW.quantity 
                                                  ELSE 0 
                                                END,
        total_closing_balance = total_closing_balance - CASE 
                                                          WHEN OLD.type = 1 THEN OLD.quantity 
                                                          WHEN OLD.type = 2 THEN -OLD.quantity 
                                                          WHEN OLD.type IN (4, 6) THEN OLD.quantity 
                                                          WHEN OLD.type IN (3, 5) THEN -OLD.quantity 
                                                          ELSE 0 
                                                        END + CASE 
                                                                WHEN NEW.type = 1 THEN NEW.quantity 
                                                                WHEN NEW.type = 2 THEN -NEW.quantity 
                                                                WHEN NEW.type IN (4, 6) THEN NEW.quantity 
                                                                WHEN NEW.type IN (3, 5) THEN -NEW.quantity 
                                                                ELSE 0 
                                                              END
    WHERE item_id = NEW.item_id AND user_id = NEW.user_id AND financial_year = NEW.financial_year;

    RETURN NEW;
END IF;
END;
$$;


ALTER FUNCTION public.update_stock_register_from_entries_on_update() OWNER TO postgres;

--
-- Name: update_stock_register_from_production_entries_on_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_stock_register_from_production_entries_on_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        DECLARE
            rec RECORD;
            stock_exists BOOLEAN;
            open_bal NUMERIC; -- Declare a variable for open_bal
        BEGIN
            -- Add a RAISE NOTICE statement to check if the trigger is working and print the old record
            RAISE NOTICE 'Trigger update_stock_register_from_production_entries_on_delete is working. OLD record: item_id=%, raw_item_id=%, production_entry_id=%, quantity=%, production_date=%', OLD.item_id, OLD.raw_item_id, OLD.production_entry_id, OLD.quantity, OLD.production_date;
  
            -- Check if stock_register data exists for the user_id, financial_year, and item_id
            SELECT EXISTS (
                SELECT 1
                FROM public.stock_register
                WHERE user_id = OLD.user_id AND financial_year = OLD.financial_year AND item_id = COALESCE(OLD.item_id, OLD.raw_item_id)
            ) INTO stock_exists;
  
            -- If stock_register data does not exist, call generate_stock_register to initialize the data
            IF NOT stock_exists THEN
                CALL generate_stock_register(COALESCE(OLD.item_id, OLD.raw_item_id), OLD.user_id, OLD.financial_year);
                RETURN OLD; -- Skip the rest of the logic
            END IF;
  
            -- Handle deletion by updating the quantity and other fields
            UPDATE public.stock_register
            SET Dispatch_To_process = Dispatch_To_process - CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END,
                Received_From_process = Received_From_process - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END,
                closing_balance = opening_balance + (quantity + CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END) + Received_From_process - Dispatch_To_process
            WHERE item_id = COALESCE(OLD.item_id, OLD.raw_item_id) AND entry_date::date = OLD.production_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year;
  
            -- Update opening_balance and closing_balance for subsequent days
            FOR rec IN
                SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
                FROM public.stock_register
                WHERE item_id = COALESCE(OLD.item_id, OLD.raw_item_id) AND entry_date::date > OLD.production_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year
                ORDER BY entry_date::date
            LOOP
                -- Fetch the closing_balance of the previous day
                SELECT COALESCE(closing_balance, 0)
                INTO open_bal
                FROM public.stock_register
                WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;
  
                -- Update the record with the new open_bal and closing_balance
                UPDATE public.stock_register
                SET opening_balance = open_bal,
                    closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
                WHERE id = rec.id;
            END LOOP;
  
            -- Update consolidated_stock_register table
            UPDATE public.consolidated_stock_register
            SET total_dispatch_to_process = total_dispatch_to_process - CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END,
                total_received_from_process = total_received_from_process - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END,
                total_closing_balance = total_closing_balance + CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END
            WHERE item_id = COALESCE(OLD.item_id, OLD.raw_item_id) AND user_id = OLD.user_id AND financial_year = OLD.financial_year;
  
            RETURN OLD;
        END;
        $$;


ALTER FUNCTION public.update_stock_register_from_production_entries_on_delete() OWNER TO postgres;

--
-- Name: update_stock_register_from_production_entries_on_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_stock_register_from_production_entries_on_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        DECLARE
            rec RECORD;
            stock_exists BOOLEAN;
            open_bal NUMERIC; -- Declare a variable for open_bal
        BEGIN
            -- Add a RAISE NOTICE statement to check if the trigger is working and print the new record
            RAISE NOTICE 'Trigger update_stock_register_from_production_entries_on_insert is working. NEW record: item_id=%, raw_item_id=%, production_entry_id=%, quantity=%, production_date=%', NEW.item_id, NEW.raw_item_id, NEW.production_entry_id, NEW.quantity, NEW.production_date;
  
            -- Check if stock_register data exists for the user_id, financial_year, and item_id
            SELECT EXISTS (
                SELECT 1
                FROM public.stock_register
                WHERE user_id = NEW.user_id AND financial_year = NEW.financial_year AND item_id = COALESCE(NEW.item_id, NEW.raw_item_id)
            ) INTO stock_exists;
  
            -- If stock_register data does not exist, call generate_stock_register to initialize the data
            IF NOT stock_exists THEN
                CALL generate_stock_register(COALESCE(NEW.item_id, NEW.raw_item_id), NEW.user_id, NEW.financial_year);
                RETURN NEW; -- Skip the rest of the logic
            END IF;
  
            -- Handle insertion by updating the quantity and other fields
            UPDATE public.stock_register
            SET Dispatch_To_process = Dispatch_To_process + CASE WHEN NEW.production_entry_id IS NULL THEN NEW.quantity ELSE 0 END,
                Received_From_process = Received_From_process + CASE WHEN NEW.production_entry_id IS NOT NULL THEN NEW.quantity ELSE 0 END,
                closing_balance = opening_balance + (quantity - CASE WHEN NEW.production_entry_id IS NULL THEN NEW.quantity ELSE 0 END + CASE WHEN NEW.production_entry_id IS NOT NULL THEN NEW.quantity ELSE 0 END) + Received_From_process - Dispatch_To_process
            WHERE item_id = COALESCE(NEW.item_id, NEW.raw_item_id) AND entry_date::date = NEW.production_date::date AND user_id = NEW.user_id AND financial_year = NEW.financial_year;
  
            -- Update opening_balance and closing_balance for subsequent days
            FOR rec IN
                SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
                FROM public.stock_register
                WHERE item_id = COALESCE(NEW.item_id, NEW.raw_item_id) AND entry_date::date > NEW.production_date::date AND user_id = NEW.user_id AND financial_year = NEW.financial_year
                ORDER BY entry_date::date
            LOOP
                -- Fetch the closing_balance of the previous day
                SELECT COALESCE(closing_balance, 0)
                INTO open_bal
                FROM public.stock_register
                WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;
  
                -- Update the record with the new open_bal and closing_balance
                UPDATE public.stock_register
                SET opening_balance = open_bal,
                    closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
                WHERE id = rec.id;
            END LOOP;
  
            -- Update consolidated_stock_register table
            UPDATE public.consolidated_stock_register
            SET total_dispatch_to_process = total_dispatch_to_process + CASE WHEN NEW.production_entry_id IS NULL THEN NEW.quantity ELSE 0 END,
                total_received_from_process = total_received_from_process + CASE WHEN NEW.production_entry_id IS NOT NULL THEN NEW.quantity ELSE 0 END,
                total_closing_balance = total_closing_balance - CASE WHEN NEW.production_entry_id IS NULL THEN NEW.quantity ELSE 0 END + CASE WHEN NEW.production_entry_id IS NOT NULL THEN NEW.quantity ELSE 0 END
            WHERE item_id = COALESCE(NEW.item_id, NEW.raw_item_id) AND user_id = NEW.user_id AND financial_year = NEW.financial_year;
  
            RETURN NEW;
        END;
        $$;


ALTER FUNCTION public.update_stock_register_from_production_entries_on_insert() OWNER TO postgres;

--
-- Name: update_stock_register_from_production_entries_on_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_stock_register_from_production_entries_on_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        DECLARE
            rec RECORD;
            stock_exists BOOLEAN;
            old_stock_exists BOOLEAN;
            open_bal NUMERIC; -- Declare a variable for open_bal
        BEGIN
            -- Add a RAISE NOTICE statement to check if the trigger is working
            RAISE NOTICE 'Trigger update_stock_register_from_production_entries_on_update is working';
        
            -- Check if stock_register data exists for the user_id, financial_year, and raw_item_id
            SELECT EXISTS (
                SELECT 1
                FROM public.stock_register
                WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND financial_year = COALESCE(NEW.financial_year, OLD.financial_year) AND item_id = COALESCE(NEW.raw_item_id, OLD.raw_item_id)
            ) INTO stock_exists;
        
            -- If stock_register data does not exist, call generate_stock_register to initialize the data
            IF NOT stock_exists THEN
                CALL generate_stock_register(COALESCE(NEW.raw_item_id, OLD.raw_item_id), COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.financial_year, OLD.financial_year));
                IF OLD.raw_item_id = NEW.raw_item_id THEN
                    RETURN COALESCE(NEW, OLD); -- Skip the rest of the logic
                END IF;
                    -- Check if stock_register data exists for the user_id, financial_year, and raw_item_id
            SELECT EXISTS (
                SELECT 1
                FROM public.stock_register
                WHERE user_id = COALESCE(OLD.user_id, NEW.user_id) AND financial_year = COALESCE(OLD.financial_year, NEW.financial_year) AND item_id = COALESCE(OLD.raw_item_id, NEW.raw_item_id)
            ) INTO old_stock_exists;
        
            -- If stock_register data does not exist for raw_item_id, call generate_stock_register to initialize the data
            IF old_stock_exists THEN
                IF OLD.raw_item_id <> NEW.raw_item_id THEN
                    -- If production_date, raw_item_id, or quantity is changed, handle it as a delete and insert
                -- Subtract OLD values
                UPDATE public.stock_register
                SET Dispatch_To_process = Dispatch_To_process - CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END,
                    Received_From_process = Received_From_process - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END,
                    closing_balance = opening_balance + (quantity + CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END) + Received_From_process - Dispatch_To_process
                WHERE item_id = COALESCE(OLD.raw_item_id) AND entry_date::date = OLD.production_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year;
        
                -- Update opening_balance and closing_balance for subsequent days
                FOR rec IN
                    SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
                    FROM public.stock_register
                    WHERE item_id = COALESCE(OLD.raw_item_id) AND entry_date::date > OLD.production_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year
                    ORDER BY entry_date::date
                LOOP
                    -- Fetch the closing_balance of the previous day
                    SELECT COALESCE(closing_balance, 0)
                    INTO open_bal
                    FROM public.stock_register
                    WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;
        
                    -- Update the record with the new open_bal and closing_balance
                    UPDATE public.stock_register
                    SET opening_balance = open_bal,
                        closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
                    WHERE id = rec.id;
                END LOOP;
        
                -- Update consolidated_stock_register table
                UPDATE public.consolidated_stock_register
                SET total_dispatch_to_process = total_dispatch_to_process - CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END,
                    total_received_from_process = total_received_from_process - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END,
                    total_closing_balance = total_closing_balance + CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END
                WHERE item_id = COALESCE(OLD.raw_item_id) AND user_id = OLD.user_id AND financial_year = OLD.financial_year;
                RETURN COALESCE(NEW, OLD); -- Skip the rest of the logic
                END IF;
            END IF;
            END IF;
        
        
            -- Check if stock_register data exists for the user_id, financial_year, and raw_item_id
            SELECT EXISTS (
                SELECT 1
                FROM public.stock_register
                WHERE user_id = COALESCE(OLD.user_id, NEW.user_id) AND financial_year = COALESCE(OLD.financial_year, NEW.financial_year) AND item_id = COALESCE(OLD.raw_item_id, NEW.raw_item_id)
            ) INTO old_stock_exists;
        
            -- If stock_register data does not exist for raw_item_id, call generate_stock_register to initialize the data
            IF NOT old_stock_exists THEN
                CALL generate_stock_register(COALESCE(OLD.raw_item_id, NEW.raw_item_id), COALESCE(OLD.user_id, NEW.user_id), COALESCE(OLD.financial_year, NEW.financial_year));
                RETURN COALESCE(NEW, OLD); -- Skip the rest of the logic
            END IF;
        
            -- Handle the case where processed_item's old value does not exist
        
            -- Handle update by subtracting OLD values and adding NEW values
            IF OLD.production_date <> NEW.production_date OR OLD.raw_item_id <> NEW.raw_item_id OR OLD.quantity <> NEW.quantity THEN
                -- If production_date, raw_item_id, or quantity is changed, handle it as a delete and insert
                -- Subtract OLD values
                UPDATE public.stock_register
                SET Dispatch_To_process = Dispatch_To_process - CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END,
                    Received_From_process = Received_From_process - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END,
                    closing_balance = opening_balance + (quantity + CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END) + Received_From_process - Dispatch_To_process
                WHERE item_id = COALESCE(OLD.raw_item_id) AND entry_date::date = OLD.production_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year;
        
                -- Update opening_balance and closing_balance for subsequent days
                FOR rec IN
                    SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
                    FROM public.stock_register
                    WHERE item_id = COALESCE(OLD.raw_item_id) AND entry_date::date > OLD.production_date::date AND user_id = OLD.user_id AND financial_year = OLD.financial_year
                    ORDER BY entry_date::date
                LOOP
                    -- Fetch the closing_balance of the previous day
                    SELECT COALESCE(closing_balance, 0)
                    INTO open_bal
                    FROM public.stock_register
                    WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;
        
                    -- Update the record with the new open_bal and closing_balance
                    UPDATE public.stock_register
                    SET opening_balance = open_bal,
                        closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
                    WHERE id = rec.id;
                END LOOP;
        
                -- Update consolidated_stock_register table
                UPDATE public.consolidated_stock_register
                SET total_dispatch_to_process = total_dispatch_to_process - CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END,
                    total_received_from_process = total_received_from_process - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END,
                    total_closing_balance = total_closing_balance + CASE WHEN OLD.production_entry_id IS NULL THEN OLD.quantity ELSE 0 END - CASE WHEN OLD.production_entry_id IS NOT NULL THEN OLD.quantity ELSE 0 END
                WHERE item_id = COALESCE(OLD.raw_item_id) AND user_id = OLD.user_id AND financial_year = OLD.financial_year;
        
                -- Add NEW values
                UPDATE public.stock_register
                SET Dispatch_To_process = Dispatch_To_process + CASE WHEN NEW.production_entry_id IS NULL THEN NEW.quantity ELSE 0 END,
                    Received_From_process = Received_From_process + CASE WHEN NEW.production_entry_id IS NOT NULL THEN NEW.quantity ELSE 0 END,
                    closing_balance = opening_balance + (quantity - CASE WHEN NEW.production_entry_id IS NULL THEN NEW.quantity ELSE 0 END + CASE WHEN NEW.production_entry_id IS NOT NULL THEN NEW.quantity ELSE 0 END) + Received_From_process - Dispatch_To_process
                WHERE item_id = COALESCE(NEW.raw_item_id) AND entry_date::date = NEW.production_date::date AND user_id = NEW.user_id AND financial_year = NEW.financial_year;
        
                -- Update opening_balance and closing_balance for subsequent days
                FOR rec IN
                    SELECT id, item_id, entry_date, quantity, closing_balance, Dispatch_To_process, Received_From_process, user_id, financial_year
                    FROM public.stock_register
                    WHERE item_id = COALESCE(NEW.raw_item_id) AND entry_date::date > NEW.production_date::date AND user_id = NEW.user_id AND financial_year = NEW.financial_year
                    ORDER BY entry_date::date
                LOOP
                    -- Fetch the closing_balance of the previous day
                    SELECT COALESCE(closing_balance, 0)
                    INTO open_bal
                    FROM public.stock_register
                    WHERE item_id = rec.item_id AND entry_date::date = rec.entry_date::date - INTERVAL '1 day' AND user_id = rec.user_id AND financial_year = rec.financial_year;
        
                    -- Update the record with the new open_bal and closing_balance
                    UPDATE public.stock_register
                    SET opening_balance = open_bal,
                        closing_balance = open_bal + rec.quantity + rec.Received_From_process - rec.Dispatch_To_process
                    WHERE id = rec.id;
                END LOOP;
        
                -- Update consolidated_stock_register table
                UPDATE public.consolidated_stock_register
                SET total_dispatch_to_process = total_dispatch_to_process + CASE WHEN NEW.production_entry_id IS NULL THEN NEW.quantity ELSE 0 END,
                    total_received_from_process = total_received_from_process + CASE WHEN NEW.production_entry_id IS NOT NULL THEN NEW.quantity ELSE 0 END,
                    total_closing_balance = total_closing_balance - CASE WHEN NEW.production_entry_id IS NULL THEN NEW.quantity ELSE 0 END + CASE WHEN NEW.production_entry_id IS NOT NULL THEN NEW.quantity ELSE 0 END
                WHERE item_id = COALESCE(NEW.raw_item_id) AND user_id = NEW.user_id AND financial_year = NEW.financial_year;
        
                RETURN NEW;
            END IF;
        
            RETURN NEW;
        END;
        $$;


ALTER FUNCTION public.update_stock_register_from_production_entries_on_update() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


ALTER TABLE public."SequelizeMeta" OWNER TO postgres;

--
-- Name: account_group; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_group (
    account_id integer NOT NULL,
    group_id integer NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.account_group OWNER TO postgres;

--
-- Name: account_list; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_list (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    user_id integer,
    credit_balance double precision DEFAULT '0'::double precision NOT NULL,
    debit_balance double precision DEFAULT '0'::double precision NOT NULL,
    financial_year character varying(255) NOT NULL,
    "isDealer" boolean DEFAULT false NOT NULL,
    type integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.account_list OWNER TO postgres;

--
-- Name: account_list_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.account_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.account_list_id_seq OWNER TO postgres;

--
-- Name: account_list_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.account_list_id_seq OWNED BY public.account_list.id;


--
-- Name: addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.addresses (
    id integer NOT NULL,
    account_id integer NOT NULL,
    street text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    postal_code character varying(255) NOT NULL,
    country text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.addresses OWNER TO postgres;

--
-- Name: addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.addresses_id_seq OWNER TO postgres;

--
-- Name: addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.addresses_id_seq OWNED BY public.addresses.id;


--
-- Name: areas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.areas (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    user_id integer,
    financial_year character varying(10),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.areas OWNER TO postgres;

--
-- Name: areas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.areas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.areas_id_seq OWNER TO postgres;

--
-- Name: areas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.areas_id_seq OWNED BY public.areas.id;


--
-- Name: balance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.balance (
    id integer NOT NULL,
    user_id integer NOT NULL,
    financial_year character varying(10) NOT NULL,
    amount numeric(10,2) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.balance OWNER TO postgres;

--
-- Name: balance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.balance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.balance_id_seq OWNER TO postgres;

--
-- Name: balance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.balance_id_seq OWNED BY public.balance.id;


--
-- Name: brokers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.brokers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    contact character varying(255) NOT NULL,
    email character varying(255),
    user_id integer,
    financial_year character varying(10),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.brokers OWNER TO postgres;

--
-- Name: brokers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.brokers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.brokers_id_seq OWNER TO postgres;

--
-- Name: brokers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.brokers_id_seq OWNED BY public.brokers.id;


--
-- Name: cash_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_entries (
    id integer NOT NULL,
    cash_date timestamp with time zone,
    narration text,
    account_id integer NOT NULL,
    type boolean NOT NULL,
    amount double precision NOT NULL,
    user_id integer,
    financial_year character varying(255) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.cash_entries OWNER TO postgres;

--
-- Name: cash_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cash_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cash_entries_id_seq OWNER TO postgres;

--
-- Name: cash_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cash_entries_id_seq OWNED BY public.cash_entries.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type integer NOT NULL,
    user_id integer,
    financial_year character varying(10),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: category_units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.category_units (
    id integer NOT NULL,
    category_id integer NOT NULL,
    unit_id integer NOT NULL,
    user_id integer,
    financial_year character varying(10),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.category_units OWNER TO postgres;

--
-- Name: category_units_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.category_units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.category_units_id_seq OWNER TO postgres;

--
-- Name: category_units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.category_units_id_seq OWNED BY public.category_units.id;


--
-- Name: consolidated_stock_register; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consolidated_stock_register (
    item_id integer NOT NULL,
    total_purchase numeric,
    total_sales numeric,
    total_sale_return numeric,
    total_purchase_return numeric,
    total_quantity numeric,
    total_closing_balance numeric,
    total_dispatch_to_process numeric,
    total_received_from_process numeric,
    user_id integer NOT NULL,
    financial_year character varying(10) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.consolidated_stock_register OWNER TO postgres;

--
-- Name: conversions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversions (
    id integer NOT NULL,
    from_unit_id integer NOT NULL,
    to_unit_id integer NOT NULL,
    rate double precision NOT NULL,
    user_id integer,
    financial_year character varying(10) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.conversions OWNER TO postgres;

--
-- Name: conversions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversions_id_seq OWNER TO postgres;

--
-- Name: conversions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversions_id_seq OWNED BY public.conversions.id;


--
-- Name: entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entries (
    id integer NOT NULL,
    category_id integer NOT NULL,
    entry_date timestamp with time zone NOT NULL,
    account_id integer,
    item_id integer NOT NULL,
    quantity numeric,
    unit_price numeric,
    total_amount numeric,
    value numeric(20,2),
    user_id integer,
    financial_year character varying(255) NOT NULL,
    unit_id integer NOT NULL,
    journal_id integer,
    type integer NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entries OWNER TO postgres;

--
-- Name: entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entries_id_seq OWNER TO postgres;

--
-- Name: entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entries_id_seq OWNED BY public.entries.id;


--
-- Name: entry_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entry_fields (
    id integer NOT NULL,
    entry_id integer NOT NULL,
    field_id integer NOT NULL,
    field_value text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entry_fields OWNER TO postgres;

--
-- Name: entry_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entry_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entry_fields_id_seq OWNER TO postgres;

--
-- Name: entry_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entry_fields_id_seq OWNED BY public.entry_fields.id;


--
-- Name: fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fields (
    id integer NOT NULL,
    field_name character varying(255) NOT NULL,
    user_id integer,
    financial_year character varying(10),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.fields OWNER TO postgres;

--
-- Name: fields_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fields_id_seq OWNER TO postgres;

--
-- Name: fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fields_id_seq OWNED BY public.fields.id;


--
-- Name: fields_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fields_mapping (
    id integer NOT NULL,
    category_id integer NOT NULL,
    field_id integer NOT NULL,
    field_type character varying(255) NOT NULL,
    required boolean NOT NULL,
    field_category integer DEFAULT 0 NOT NULL,
    exclude_from_total boolean DEFAULT false NOT NULL,
    type integer NOT NULL,
    user_id integer,
    financial_year character varying(10),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.fields_mapping OWNER TO postgres;

--
-- Name: fields_mapping_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fields_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fields_mapping_id_seq OWNER TO postgres;

--
-- Name: fields_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fields_mapping_id_seq OWNED BY public.fields_mapping.id;


--
-- Name: group_list; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_list (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    user_id integer,
    credit_balance double precision DEFAULT '0'::double precision NOT NULL,
    debit_balance double precision DEFAULT '0'::double precision NOT NULL,
    financial_year character varying(255) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.group_list OWNER TO postgres;

--
-- Name: group_list_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.group_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_list_id_seq OWNER TO postgres;

--
-- Name: group_list_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.group_list_id_seq OWNED BY public.group_list.id;


--
-- Name: group_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_mapping (
    id integer NOT NULL,
    parent_id integer,
    group_id integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.group_mapping OWNER TO postgres;

--
-- Name: group_mapping_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.group_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_mapping_id_seq OWNER TO postgres;

--
-- Name: group_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.group_mapping_id_seq OWNED BY public.group_mapping.id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    user_id integer,
    financial_year character varying(10) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.items_id_seq OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_entries (
    id integer NOT NULL,
    journal_date timestamp with time zone NOT NULL,
    description text,
    user_id integer,
    financial_year character varying(255) NOT NULL,
    type integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.journal_entries OWNER TO postgres;

--
-- Name: journal_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.journal_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.journal_entries_id_seq OWNER TO postgres;

--
-- Name: journal_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.journal_entries_id_seq OWNED BY public.journal_entries.id;


--
-- Name: journal_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_items (
    journal_id integer NOT NULL,
    account_id integer NOT NULL,
    group_id integer NOT NULL,
    amount double precision DEFAULT '0'::double precision NOT NULL,
    type boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.journal_items OWNER TO postgres;

--
-- Name: processed_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.processed_items (
    id integer NOT NULL,
    raw_item_id integer,
    item_id integer,
    unit_id integer,
    percentage double precision NOT NULL,
    conversion_id integer,
    user_id integer,
    financial_year character varying(10) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.processed_items OWNER TO postgres;

--
-- Name: processed_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.processed_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.processed_items_id_seq OWNER TO postgres;

--
-- Name: processed_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.processed_items_id_seq OWNED BY public.processed_items.id;


--
-- Name: production_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_entries (
    id integer NOT NULL,
    raw_item_id integer,
    item_id integer,
    unit_id integer,
    production_date timestamp with time zone,
    quantity numeric(10,2),
    percentage double precision,
    user_id integer,
    financial_year character varying(10) NOT NULL,
    conversion_id integer,
    production_entry_id integer,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.production_entries OWNER TO postgres;

--
-- Name: production_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.production_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.production_entries_id_seq OWNER TO postgres;

--
-- Name: production_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.production_entries_id_seq OWNED BY public.production_entries.id;


--
-- Name: raw_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.raw_items (
    id integer NOT NULL,
    item_id integer,
    unit_id integer,
    user_id integer,
    financial_year character varying(10) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.raw_items OWNER TO postgres;

--
-- Name: raw_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.raw_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.raw_items_id_seq OWNER TO postgres;

--
-- Name: raw_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.raw_items_id_seq OWNED BY public.raw_items.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(255),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: stock_register_new_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_register_new_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_register_new_id_seq OWNER TO postgres;

--
-- Name: stock_register; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_register (
    id integer DEFAULT nextval('public.stock_register_new_id_seq'::regclass) NOT NULL,
    entry_id integer,
    production_entry_id integer,
    item_id integer NOT NULL,
    entry_date date NOT NULL,
    opening_balance numeric NOT NULL,
    quantity numeric NOT NULL,
    closing_balance numeric NOT NULL,
    entry_type character varying(20) NOT NULL,
    user_id integer NOT NULL,
    financial_year character varying(10) NOT NULL,
    dispatch_to_process numeric DEFAULT 0 NOT NULL,
    received_from_process numeric DEFAULT 0 NOT NULL,
    purchase numeric DEFAULT 0 NOT NULL,
    sales numeric DEFAULT 0 NOT NULL,
    sale_return numeric DEFAULT 0 NOT NULL,
    purchase_return numeric DEFAULT 0 NOT NULL
)
PARTITION BY LIST (financial_year);


ALTER TABLE public.stock_register OWNER TO postgres;

--
-- Name: units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.units (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    user_id integer,
    financial_year character varying(10),
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.units OWNER TO postgres;

--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.units_id_seq OWNER TO postgres;

--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    "roleId" integer NOT NULL,
    "userId" integer NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    firstname character varying(250) NOT NULL,
    middlename text,
    lastname character varying(250) NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    last_login timestamp with time zone,
    type boolean DEFAULT false NOT NULL,
    status boolean DEFAULT true NOT NULL,
    "loginAttempts" integer DEFAULT 0,
    email character varying(255) NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: account_list id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_list ALTER COLUMN id SET DEFAULT nextval('public.account_list_id_seq'::regclass);


--
-- Name: addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses ALTER COLUMN id SET DEFAULT nextval('public.addresses_id_seq'::regclass);


--
-- Name: areas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areas ALTER COLUMN id SET DEFAULT nextval('public.areas_id_seq'::regclass);


--
-- Name: balance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balance ALTER COLUMN id SET DEFAULT nextval('public.balance_id_seq'::regclass);


--
-- Name: brokers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brokers ALTER COLUMN id SET DEFAULT nextval('public.brokers_id_seq'::regclass);


--
-- Name: cash_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_entries ALTER COLUMN id SET DEFAULT nextval('public.cash_entries_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: category_units id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category_units ALTER COLUMN id SET DEFAULT nextval('public.category_units_id_seq'::regclass);


--
-- Name: conversions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversions ALTER COLUMN id SET DEFAULT nextval('public.conversions_id_seq'::regclass);


--
-- Name: entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries ALTER COLUMN id SET DEFAULT nextval('public.entries_id_seq'::regclass);


--
-- Name: entry_fields id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entry_fields ALTER COLUMN id SET DEFAULT nextval('public.entry_fields_id_seq'::regclass);


--
-- Name: fields id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fields ALTER COLUMN id SET DEFAULT nextval('public.fields_id_seq'::regclass);


--
-- Name: fields_mapping id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fields_mapping ALTER COLUMN id SET DEFAULT nextval('public.fields_mapping_id_seq'::regclass);


--
-- Name: group_list id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_list ALTER COLUMN id SET DEFAULT nextval('public.group_list_id_seq'::regclass);


--
-- Name: group_mapping id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_mapping ALTER COLUMN id SET DEFAULT nextval('public.group_mapping_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: journal_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries ALTER COLUMN id SET DEFAULT nextval('public.journal_entries_id_seq'::regclass);


--
-- Name: processed_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processed_items ALTER COLUMN id SET DEFAULT nextval('public.processed_items_id_seq'::regclass);


--
-- Name: production_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_entries ALTER COLUMN id SET DEFAULT nextval('public.production_entries_id_seq'::regclass);


--
-- Name: raw_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_items ALTER COLUMN id SET DEFAULT nextval('public.raw_items_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: account_group account_group_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_group
    ADD CONSTRAINT account_group_pkey PRIMARY KEY (account_id, group_id);


--
-- Name: account_list account_list_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_list
    ADD CONSTRAINT account_list_pkey PRIMARY KEY (id);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: balance balance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balance
    ADD CONSTRAINT balance_pkey PRIMARY KEY (id);


--
-- Name: balance balance_user_id_financial_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balance
    ADD CONSTRAINT balance_user_id_financial_year_key UNIQUE (user_id, financial_year);


--
-- Name: brokers brokers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT brokers_pkey PRIMARY KEY (id);


--
-- Name: cash_entries cash_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_entries
    ADD CONSTRAINT cash_entries_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: category_units category_units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category_units
    ADD CONSTRAINT category_units_pkey PRIMARY KEY (id);


--
-- Name: consolidated_stock_register consolidated_stock_register_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consolidated_stock_register
    ADD CONSTRAINT consolidated_stock_register_pkey PRIMARY KEY (item_id, user_id, financial_year);


--
-- Name: conversions conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversions
    ADD CONSTRAINT conversions_pkey PRIMARY KEY (id);


--
-- Name: entries entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_pkey PRIMARY KEY (id);


--
-- Name: entry_fields entry_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entry_fields
    ADD CONSTRAINT entry_fields_pkey PRIMARY KEY (id);


--
-- Name: fields_mapping fields_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fields_mapping
    ADD CONSTRAINT fields_mapping_pkey PRIMARY KEY (id);


--
-- Name: fields fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fields
    ADD CONSTRAINT fields_pkey PRIMARY KEY (id);


--
-- Name: group_list group_list_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_list
    ADD CONSTRAINT group_list_pkey PRIMARY KEY (id);


--
-- Name: group_mapping group_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_mapping
    ADD CONSTRAINT group_mapping_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: processed_items processed_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processed_items
    ADD CONSTRAINT processed_items_pkey PRIMARY KEY (id);


--
-- Name: production_entries production_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_entries
    ADD CONSTRAINT production_entries_pkey PRIMARY KEY (id);


--
-- Name: raw_items raw_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_items
    ADD CONSTRAINT raw_items_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: stock_register stock_register_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_register
    ADD CONSTRAINT stock_register_pkey PRIMARY KEY (id, financial_year, user_id);


--
-- Name: stock_register unique_stock_register; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_register
    ADD CONSTRAINT unique_stock_register UNIQUE (item_id, entry_date, user_id, financial_year);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_conversions_from_unit_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversions_from_unit_id ON public.conversions USING btree (from_unit_id);


--
-- Name: idx_conversions_to_unit_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversions_to_unit_id ON public.conversions USING btree (to_unit_id);


--
-- Name: idx_entries_entry_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entries_entry_date ON public.entries USING btree (entry_date);


--
-- Name: idx_entries_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entries_item_id ON public.entries USING btree (item_id);


--
-- Name: idx_entries_user_financial_year_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entries_user_financial_year_type ON public.entries USING btree (user_id, financial_year, type);


--
-- Name: idx_fields_mapping_category_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fields_mapping_category_type ON public.fields_mapping USING btree (category_id, type);


--
-- Name: idx_fields_mapping_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fields_mapping_type ON public.fields_mapping USING btree (type);


--
-- Name: idx_items_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_name ON public.items USING btree (name);


--
-- Name: idx_processed_items_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processed_items_item_id ON public.processed_items USING btree (item_id);


--
-- Name: idx_processed_items_raw_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processed_items_raw_item_id ON public.processed_items USING btree (raw_item_id);


--
-- Name: idx_processed_items_unit_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_processed_items_unit_id ON public.processed_items USING btree (unit_id);


--
-- Name: idx_production_entries_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_production_entries_item_id ON public.production_entries USING btree (item_id);


--
-- Name: idx_production_entries_production_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_production_entries_production_date ON public.production_entries USING btree (production_date);


--
-- Name: idx_production_entries_raw_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_production_entries_raw_item_id ON public.production_entries USING btree (raw_item_id);


--
-- Name: idx_production_entries_user_financial_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_production_entries_user_financial_year ON public.production_entries USING btree (user_id, financial_year);


--
-- Name: idx_raw_items_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_raw_items_item_id ON public.raw_items USING btree (item_id);


--
-- Name: idx_raw_items_unit_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_raw_items_unit_id ON public.raw_items USING btree (unit_id);


--
-- Name: idx_stock_register_entry_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_register_entry_date ON ONLY public.stock_register USING btree (entry_date);


--
-- Name: idx_stock_register_financial_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_register_financial_year ON ONLY public.stock_register USING btree (financial_year);


--
-- Name: idx_stock_register_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_register_item_id ON ONLY public.stock_register USING btree (item_id);


--
-- Name: idx_stock_register_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_register_user_id ON ONLY public.stock_register USING btree (user_id);


--
-- Name: production_entries trg_update_stock_register_from_production_entries_on_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_stock_register_from_production_entries_on_delete AFTER DELETE ON public.production_entries FOR EACH ROW EXECUTE FUNCTION public.update_stock_register_from_production_entries_on_delete();


--
-- Name: production_entries trg_update_stock_register_from_production_entries_on_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_stock_register_from_production_entries_on_insert AFTER INSERT ON public.production_entries FOR EACH ROW EXECUTE FUNCTION public.update_stock_register_from_production_entries_on_insert();


--
-- Name: production_entries trg_update_stock_register_from_production_entries_on_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_stock_register_from_production_entries_on_update AFTER UPDATE ON public.production_entries FOR EACH ROW EXECUTE FUNCTION public.update_stock_register_from_production_entries_on_update();


--
-- Name: entries trg_update_stock_register_on_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_stock_register_on_delete AFTER DELETE ON public.entries FOR EACH ROW EXECUTE FUNCTION public.update_stock_register_from_entries_on_delete();


--
-- Name: entries trg_update_stock_register_on_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_stock_register_on_insert AFTER INSERT ON public.entries FOR EACH ROW EXECUTE FUNCTION public.update_stock_register_from_entries_on_insert();


--
-- Name: entries trg_update_stock_register_on_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_stock_register_on_update AFTER UPDATE ON public.entries FOR EACH ROW EXECUTE FUNCTION public.update_stock_register_from_entries_on_update();


--
-- Name: cash_entries update_balance_after_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_balance_after_delete AFTER DELETE ON public.cash_entries FOR EACH ROW EXECUTE FUNCTION public.update_balance();


--
-- Name: cash_entries update_balance_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_balance_after_insert AFTER INSERT ON public.cash_entries FOR EACH ROW EXECUTE FUNCTION public.update_balance();


--
-- Name: cash_entries update_balance_after_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_balance_after_update AFTER UPDATE ON public.cash_entries FOR EACH ROW EXECUTE FUNCTION public.update_balance();


--
-- Name: account_group account_group_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_group
    ADD CONSTRAINT account_group_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account_list(id) ON DELETE CASCADE;


--
-- Name: account_group account_group_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_group
    ADD CONSTRAINT account_group_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.group_list(id) ON DELETE CASCADE;


--
-- Name: cash_entries cash_entries_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_entries
    ADD CONSTRAINT cash_entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account_list(id);


--
-- Name: category_units category_units_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category_units
    ADD CONSTRAINT category_units_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: category_units category_units_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category_units
    ADD CONSTRAINT category_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conversions conversions_from_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversions
    ADD CONSTRAINT conversions_from_unit_id_fkey FOREIGN KEY (from_unit_id) REFERENCES public.units(id);


--
-- Name: conversions conversions_to_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversions
    ADD CONSTRAINT conversions_to_unit_id_fkey FOREIGN KEY (to_unit_id) REFERENCES public.units(id);


--
-- Name: entries entries_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account_list(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: entries entries_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: entries entries_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: entries entries_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal_entries(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: entries entries_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: entry_fields entry_fields_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entry_fields
    ADD CONSTRAINT entry_fields_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.entries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: entry_fields entry_fields_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entry_fields
    ADD CONSTRAINT entry_fields_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fields_mapping fields_mapping_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fields_mapping
    ADD CONSTRAINT fields_mapping_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fields_mapping fields_mapping_field_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fields_mapping
    ADD CONSTRAINT fields_mapping_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.fields(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: group_mapping group_mapping_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_mapping
    ADD CONSTRAINT group_mapping_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.group_list(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: group_mapping group_mapping_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_mapping
    ADD CONSTRAINT group_mapping_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.group_mapping(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: journal_items journal_items_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_items
    ADD CONSTRAINT journal_items_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account_list(id) ON DELETE CASCADE;


--
-- Name: journal_items journal_items_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_items
    ADD CONSTRAINT journal_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.group_list(id) ON DELETE CASCADE;


--
-- Name: journal_items journal_items_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_items
    ADD CONSTRAINT journal_items_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: processed_items processed_items_conversion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processed_items
    ADD CONSTRAINT processed_items_conversion_id_fkey FOREIGN KEY (conversion_id) REFERENCES public.conversions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: processed_items processed_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processed_items
    ADD CONSTRAINT processed_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: processed_items processed_items_raw_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processed_items
    ADD CONSTRAINT processed_items_raw_item_id_fkey FOREIGN KEY (raw_item_id) REFERENCES public.raw_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: processed_items processed_items_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processed_items
    ADD CONSTRAINT processed_items_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: production_entries production_entries_conversion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_entries
    ADD CONSTRAINT production_entries_conversion_id_fkey FOREIGN KEY (conversion_id) REFERENCES public.conversions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: production_entries production_entries_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_entries
    ADD CONSTRAINT production_entries_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: production_entries production_entries_production_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_entries
    ADD CONSTRAINT production_entries_production_entry_id_fkey FOREIGN KEY (production_entry_id) REFERENCES public.production_entries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: production_entries production_entries_raw_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_entries
    ADD CONSTRAINT production_entries_raw_item_id_fkey FOREIGN KEY (raw_item_id) REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: production_entries production_entries_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_entries
    ADD CONSTRAINT production_entries_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raw_items raw_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_items
    ADD CONSTRAINT raw_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raw_items raw_items_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.raw_items
    ADD CONSTRAINT raw_items_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stock_register stock_register_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_register
    ADD CONSTRAINT stock_register_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.entries(id);


--
-- Name: stock_register stock_register_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_register
    ADD CONSTRAINT stock_register_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: stock_register stock_register_production_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_register
    ADD CONSTRAINT stock_register_production_entry_id_fkey FOREIGN KEY (production_entry_id) REFERENCES public.production_entries(id);


--
-- Name: user_roles user_roles_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

