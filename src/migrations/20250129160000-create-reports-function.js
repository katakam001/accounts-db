'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.update_stock_register_from_entries_on_insert()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
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
      $function$;
    `);
        await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION public.update_stock_register_from_entries_on_delete()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
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
        $function$;
      `);
        await queryInterface.sequelize.query(`
CREATE OR REPLACE FUNCTION public.update_stock_register_from_entries_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;
      `);
        await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION public.update_stock_register_from_production_entries_on_insert()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
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
        $function$;
      `);
        await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION public.update_stock_register_from_production_entries_on_delete()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
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
        $function$;
      `);
        await queryInterface.sequelize.query(`       
        CREATE OR REPLACE FUNCTION public.update_stock_register_from_production_entries_on_update()
         RETURNS trigger
         LANGUAGE plpgsql
        AS $function$
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
        $function$;
            `);
        await queryInterface.sequelize.query(`
                CREATE OR REPLACE FUNCTION public.update_balance()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $function$
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
                $function$;
              `);

    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS public.update_stock_register_from_entries_on_insert();
    `);
        await queryInterface.sequelize.query(`
        DROP FUNCTION IF EXISTS public.update_stock_register_from_entries_on_delete();
      `);
        await queryInterface.sequelize.query(`
        DROP FUNCTION IF EXISTS public.update_stock_register_from_entries_on_update();
      `);
        await queryInterface.sequelize.query(`
        DROP FUNCTION IF EXISTS public.update_stock_register_from_production_entries_on_insert();
      `);
        await queryInterface.sequelize.query(`
        DROP FUNCTION IF EXISTS public.update_stock_register_from_production_entries_on_delete();
      `);
        await queryInterface.sequelize.query(`
        DROP FUNCTION IF EXISTS public.update_stock_register_from_production_entries_on_update();
      `);
        await queryInterface.sequelize.query(`
        DROP FUNCTION IF EXISTS public.update_balance();
      `);
    }
};
