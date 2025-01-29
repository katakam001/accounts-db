'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addConstraint('balance', {
      fields: ['user_id', 'financial_year'],
      type: 'unique',
      name: 'balance_user_id_financial_year_key'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('balance', 'balance_user_id_financial_year_key');
  }
};
