'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TRIGGER trg_update_stock_register_on_delete
      AFTER DELETE ON public.entries
      FOR EACH ROW EXECUTE FUNCTION update_stock_register_from_entries_on_delete();

      CREATE TRIGGER trg_update_stock_register_on_insert
      AFTER INSERT ON public.entries
      FOR EACH ROW EXECUTE FUNCTION update_stock_register_from_entries_on_insert();

      CREATE TRIGGER trg_update_stock_register_on_update
      AFTER UPDATE ON public.entries
      FOR EACH ROW EXECUTE FUNCTION update_stock_register_from_entries_on_update();

      CREATE TRIGGER trg_update_stock_register_from_production_entries_on_delete
      AFTER DELETE ON public.production_entries
      FOR EACH ROW EXECUTE FUNCTION update_stock_register_from_production_entries_on_delete();

      CREATE TRIGGER trg_update_stock_register_from_production_entries_on_insert
      AFTER INSERT ON public.production_entries
      FOR EACH ROW EXECUTE FUNCTION update_stock_register_from_production_entries_on_insert();

      CREATE TRIGGER trg_update_stock_register_from_production_entries_on_update
      AFTER UPDATE ON public.production_entries
      FOR EACH ROW EXECUTE FUNCTION update_stock_register_from_production_entries_on_update();

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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_update_stock_register_on_delete ON public.entries;
      DROP TRIGGER IF EXISTS trg_update_stock_register_on_insert ON public.entries;
      DROP TRIGGER IF EXISTS trg_update_stock_register_on_update ON public.entries;
      DROP TRIGGER IF EXISTS trg_update_stock_register_from_production_entries_on_delete ON public.production_entries;
      DROP TRIGGER IF EXISTS trg_update_stock_register_from_production_entries_on_insert ON public.production_entries;
      DROP TRIGGER IF EXISTS trg_update_stock_register_from_production_entries_on_update ON public.production_entries;
      DROP TRIGGER IF EXISTS update_balance_after_insert ON public.cash_entries;
      DROP TRIGGER IF EXISTS update_balance_after_update ON public.cash_entries;
      DROP TRIGGER IF EXISTS update_balance_after_delete ON public.cash_entries;
    `);
  }
};
