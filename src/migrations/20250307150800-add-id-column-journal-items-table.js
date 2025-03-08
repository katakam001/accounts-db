'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.addColumn('journal_items', 'id', {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      });
    },
  
    down: async (queryInterface, Sequelize) => {
      await queryInterface.removeColumn('journal_items', 'id');
    }
};
  
