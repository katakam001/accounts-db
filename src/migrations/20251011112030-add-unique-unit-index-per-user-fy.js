'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create case-insensitive unique index on user_id, financial_year, lower(unit_name)
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX unique_unit_per_user_fy 
      ON units (user_id, financial_year, LOWER(name));
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the index if rolling back
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS unique_unit_per_user_fy;
    `);
  }
};
