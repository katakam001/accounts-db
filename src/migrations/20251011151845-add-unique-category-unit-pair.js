'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE category_units
      ADD CONSTRAINT unique_category_unit_pair
      UNIQUE (category_id, unit_id);
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE category_units
      DROP CONSTRAINT IF EXISTS unique_category_unit_pair;
    `);
  }
};
