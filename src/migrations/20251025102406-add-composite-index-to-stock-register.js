'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('stock_register', ['user_id', 'financial_year', 'item_id'], {
      name: 'idx_stock_register_user_year_item',
      using: 'BTREE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('stock_register', 'idx_stock_register_user_year_item');
  }
};
