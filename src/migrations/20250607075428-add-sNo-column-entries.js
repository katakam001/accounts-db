'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('entries', 'sNo', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1, // ✅ Default value set to 1
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('entries', 'sNo');
  },
};
