'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.addColumn('group_mapping', 'user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
  
      await queryInterface.addColumn('group_mapping', 'financial_year', {
        type: Sequelize.STRING(10),
        allowNull: true,
      });
    },
  
    down: async (queryInterface, Sequelize) => {
      await queryInterface.removeColumn('group_mapping', 'user_id');
      await queryInterface.removeColumn('group_mapping', 'financial_year');
    }
};
  
