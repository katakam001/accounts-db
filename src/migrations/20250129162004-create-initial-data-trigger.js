'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TRIGGER trigger_insert_initial_data
      AFTER INSERT ON financial_year_tracking
      FOR EACH ROW
      EXECUTE FUNCTION insert_initial_data();
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS trigger_insert_initial_data ON financial_year_tracking;
    `);
  }
};
