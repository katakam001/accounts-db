'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE fields_mapping
      ADD CONSTRAINT unique_category_field_pair
      UNIQUE (category_id, field_id);
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE fields_mapping
      DROP CONSTRAINT IF EXISTS unique_category_field_pair;
    `);
  }
};
