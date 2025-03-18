'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Function for row-level updates
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.update_balance()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      DECLARE
          balance_record RECORD;
          amount_diff DECIMAL(10, 2);
          is_batch_active BOOLEAN;
      BEGIN
          -- Check if a batch operation is active for the specific user_id and financial_year
          SELECT COALESCE(is_batch, FALSE) INTO is_batch_active
          FROM global_batch_operations
          WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
            AND financial_year = COALESCE(NEW.financial_year, OLD.financial_year)
            AND is_batch = TRUE
          LIMIT 1;

          -- If batch operation is active, skip row-level trigger
          IF is_batch_active THEN
              RAISE NOTICE 'Skipping row-level trigger for batch operation (user_id=%, financial_year=%).',
                  COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.financial_year, OLD.financial_year);
              RETURN NEW;
          END IF;

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
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS public.update_balance;`);
  },
};
