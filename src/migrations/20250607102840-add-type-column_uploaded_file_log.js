'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('uploaded_file_log', 'type', {
      type: Sequelize.INTEGER,
      allowNull: true, // ✅ Allows NULL values
      defaultValue: 0, // ✅ Sets default to 0
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('uploaded_file_log', 'type');
  },
};
