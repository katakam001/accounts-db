'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('cash_entries', 'is_cash_adjustment', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('cash_entries_batch', 'is_cash_adjustment', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('cash_entries', 'is_cash_adjustment');
    await queryInterface.removeColumn('cash_entries_batch', 'is_cash_adjustment');
  }
};
