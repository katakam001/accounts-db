'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create the sequence
    await queryInterface.sequelize.query(`
      CREATE SEQUENCE stock_register_new_id_seq
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1;
    `);

    // Create the stock_register table with partitioning
    await queryInterface.sequelize.query(`
      CREATE TABLE public.stock_register (
        id int4 DEFAULT nextval('stock_register_new_id_seq'::regclass) NOT NULL,
        entry_id int4 NULL,
        production_entry_id int4 NULL,
        item_id int4 NOT NULL,
        entry_date date NOT NULL,
        opening_balance numeric NOT NULL,
        quantity numeric NOT NULL,
        closing_balance numeric NOT NULL,
        entry_type varchar(20) NOT NULL,
        user_id int4 NOT NULL,
        financial_year varchar(10) NOT NULL,
        dispatch_to_process numeric DEFAULT 0 NOT NULL,
        received_from_process numeric DEFAULT 0 NOT NULL,
        purchase numeric DEFAULT 0 NOT NULL,
        sales numeric DEFAULT 0 NOT NULL,
        sale_return numeric DEFAULT 0 NOT NULL,
        purchase_return numeric DEFAULT 0 NOT NULL,
        CONSTRAINT stock_register_pkey PRIMARY KEY (id, financial_year, user_id),
        CONSTRAINT unique_stock_register UNIQUE (item_id, entry_date, user_id, financial_year),
        CONSTRAINT stock_register_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.entries(id),
        CONSTRAINT stock_register_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id),
        CONSTRAINT stock_register_production_entry_id_fkey FOREIGN KEY (production_entry_id) REFERENCES public.production_entries(id)
      )
      PARTITION BY LIST (financial_year);
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the stock_register table
    await queryInterface.dropTable('stock_register');

    // Drop the sequence
    await queryInterface.sequelize.query(`
      DROP SEQUENCE IF EXISTS stock_register_new_id_seq;
    `);
  }
};
