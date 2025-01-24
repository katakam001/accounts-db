'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Create function for getting vacuum schedule
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.get_vacuum_schedule()
      RETURNS TABLE(table_name text, schedule text)
      LANGUAGE plpgsql
      AS $function$
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
      $function$
    `);

    // Create function for scheduling vacuum jobs
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.schedule_vacuum_jobs()
      RETURNS void
      LANGUAGE plpgsql
      AS $function$
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
      $function$
    `);
  },

  async down (queryInterface, Sequelize) {
    // Drop function for getting vacuum schedule
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS public.get_vacuum_schedule;
    `);

    // Drop function for scheduling vacuum jobs
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS public.schedule_vacuum_jobs;
    `);
  }
};
