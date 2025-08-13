'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trg_update_stock_register_on_delete ON public.entries;
      DROP TRIGGER IF EXISTS trg_update_stock_register_on_insert ON public.entries;
      DROP TRIGGER IF EXISTS trg_update_stock_register_on_update ON public.entries;

      DROP TRIGGER IF EXISTS trg_update_stock_register_from_production_entries_on_delete ON public.production_entries;
      DROP TRIGGER IF EXISTS trg_update_stock_register_from_production_entries_on_insert ON public.production_entries;
      DROP TRIGGER IF EXISTS trg_update_stock_register_from_production_entries_on_update ON public.production_entries;
    `);
  },

  async down(queryInterface) {
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
    `);
  }
};
