'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_items_name;

      CREATE UNIQUE INDEX unique_item_name_per_user_year
      ON items (
        LOWER(name),
        user_id,
        financial_year
      );
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS unique_item_name_per_user_year;

      CREATE INDEX idx_items_name ON items USING btree (name);
    `);
  }
};
