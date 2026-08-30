'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameTable('closing_stock_valuation', 'stock_valuation');
    await queryInterface.renameColumn('stock_valuation', 'value', 'closing_stock_valuation');
    await queryInterface.addColumn('stock_valuation', 'opening_stock_valuation', {
      type: Sequelize.NUMERIC(15, 2),
      allowNull: true,
    });
    await queryInterface.addIndex('stock_valuation', {
      name: 'idx_stock_valuation_lookup',
      fields: ['item_id', 'user_id', 'financial_year', 'start_date', 'end_date'],
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('stock_valuation', 'idx_stock_valuation_lookup');
    await queryInterface.removeColumn('stock_valuation', 'opening_stock_valuation');
    await queryInterface.renameColumn('stock_valuation', 'closing_stock_valuation', 'value');
    await queryInterface.renameTable('stock_valuation', 'closing_stock_valuation');
  }
};
