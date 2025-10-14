'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX unique_field_name_per_user_year
      ON fields (
        LOWER(field_name),
        user_id,
        financial_year
      );
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS unique_field_name_per_user_year;
    `);
  }
};
