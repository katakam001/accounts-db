'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create unique index on lower(name), user_id, financial_year
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX unique_area_per_user_year
      ON areas (lower(name), user_id, financial_year);
    `);
  },

  async down(queryInterface, Sequelize) {
    // Drop the unique index if rolling back
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS unique_area_per_user_year;
    `);
  }
};
