'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS update_balance_after_insert ON public.cash_entries;
      DROP TRIGGER IF EXISTS update_balance_after_update ON public.cash_entries;
      DROP TRIGGER IF EXISTS update_balance_after_delete ON public.cash_entries;
    `);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TRIGGER update_balance_after_insert
      AFTER INSERT ON public.cash_entries
      FOR EACH ROW EXECUTE FUNCTION update_balance();

      CREATE TRIGGER update_balance_after_update
      AFTER UPDATE ON public.cash_entries
      FOR EACH ROW EXECUTE FUNCTION update_balance();

      CREATE TRIGGER update_balance_after_delete
      AFTER DELETE ON public.cash_entries
      FOR EACH ROW EXECUTE FUNCTION update_balance();
    `);
  }
};
