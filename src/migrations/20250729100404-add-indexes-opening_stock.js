'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ✅ Composite index: item_id + user_id + financial_year
    await queryInterface.addIndex(
      'opening_stock',
      ['item_id', 'user_id', 'financial_year'],
      {
        name: 'idx_opening_stock_item_user_year',
        using: 'btree',
      }
    );

    // ✅ Secondary index: user_id + financial_year
    await queryInterface.addIndex(
      'opening_stock',
      ['user_id', 'financial_year'],
      {
        name: 'idx_opening_stock_user_year',
        using: 'btree',
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('opening_stock', 'idx_opening_stock_item_user_year');
    await queryInterface.removeIndex('opening_stock', 'idx_opening_stock_user_year');
  }
};
