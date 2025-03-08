'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
CREATE OR REPLACE FUNCTION public.insert_initial_data()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    group_level INTEGER; -- Current hierarchy level
    group_record RECORD; -- Record to iterate through each group at the current level
    parent_group_mapping_id INTEGER; -- ID of the parent in group_mapping
BEGIN
    -- Batch insert default data into account_list table
    INSERT INTO account_list (user_id, financial_year, name, description, credit_balance, debit_balance, "isDealer", type, "createdAt", "updatedAt")
    SELECT NEW.user_id, NEW.financial_year, name, description, credit_balance, debit_balance, "isDealer", type, NOW(), NOW()
    FROM default_account_list;

    -- Batch insert default data into fields table
    INSERT INTO fields (user_id, financial_year, field_name, "createdAt", "updatedAt")
    SELECT NEW.user_id, NEW.financial_year, field_name, NOW(), NOW()
    FROM default_fields;

    -- Batch insert default data into group_list table
    INSERT INTO group_list (user_id, financial_year, name, description, credit_balance, debit_balance, "createdAt", "updatedAt")
    SELECT NEW.user_id, NEW.financial_year, name, description, credit_balance, debit_balance, NOW(), NOW()
    FROM default_group_list;

        -- Insert specific account-group links into account_group table
        INSERT INTO account_group (account_id, group_id, "createdAt", "updatedAt")
        SELECT 
          al.id AS account_id,
          gl.id AS group_id,
          NOW(), NOW()
        FROM 
          default_account_group dag
          JOIN account_list al ON al.name = dag.account_name AND al.user_id = NEW.user_id AND al.financial_year = NEW.financial_year
          JOIN group_list gl ON gl.name = dag.group_name AND gl.user_id = NEW.user_id AND gl.financial_year = NEW.financial_year;
    -- Process groups level by level
    FOR group_level IN
        SELECT DISTINCT hierarchy_level
        FROM default_group_mapping
        ORDER BY hierarchy_level
    LOOP
        FOR group_record IN
            SELECT dgm.parent_name, dgm.group_name,
                (SELECT id FROM group_list WHERE name = dgm.parent_name AND user_id = NEW.user_id AND financial_year = NEW.financial_year) AS parent_group_list_id,
                (SELECT id FROM group_list WHERE name = dgm.group_name AND user_id = NEW.user_id AND financial_year = NEW.financial_year) AS child_group_list_id
            FROM default_group_mapping dgm
            WHERE dgm.hierarchy_level = group_level
        LOOP
            -- If it's Level 1 (top-level groups), parent_id is NULL
            IF group_level = 1 THEN
                INSERT INTO group_mapping (parent_id, group_id, user_id, financial_year, "createdAt", "updatedAt")
                VALUES (
                    NULL, -- No parent for top-level groups
                    group_record.child_group_list_id,
                    NEW.user_id,
                    NEW.financial_year,
                    NOW(),
                    NOW()
                )
                RETURNING id INTO parent_group_mapping_id; -- Get the ID of the inserted group_mapping

            ELSE
                -- For levels > 1, parent_id comes from group_mapping
                INSERT INTO group_mapping (parent_id, group_id, user_id, financial_year, "createdAt", "updatedAt")
                VALUES (
                    (SELECT id FROM group_mapping WHERE group_id = group_record.parent_group_list_id AND user_id = NEW.user_id AND financial_year = NEW.financial_year),
                    group_record.child_group_list_id,
                    NEW.user_id,
                    NEW.financial_year,
                    NOW(),
                    NOW()
                )
                RETURNING id INTO parent_group_mapping_id; -- Get the ID of the inserted group_mapping
            END IF;
        END LOOP;
    END LOOP;

    RETURN NEW;
END;
$function$;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trigger_insert_initial_data ON financial_year_tracking;
    `);
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS public.insert_initial_data();
    `);
  }
};
