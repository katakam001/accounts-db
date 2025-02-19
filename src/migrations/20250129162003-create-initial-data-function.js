'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.insert_initial_data()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
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

        RETURN NEW;
      END;
      $function$;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS public.insert_initial_data();
    `);
  }
};
