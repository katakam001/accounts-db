'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add group_id column to cash_entries
    await queryInterface.addColumn('cash_entries', 'group_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'group_list', // The name of the Group table (ensure correct name)
        key: 'id'
      },
      onDelete: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove group_id column from cash_entries
    await queryInterface.removeColumn('cash_entries', 'group_id');
  }
};
