'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add status column
    await queryInterface.addColumn('financial_year_tracking', 'status', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1, // 1 = default seeded, 2 = in progress, 3 = ready, 4 = failed
    });

    // Add error_message column
    await queryInterface.addColumn('financial_year_tracking', 'error_message', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove columns if rolled back
    await queryInterface.removeColumn('financial_year_tracking', 'status');
    await queryInterface.removeColumn('financial_year_tracking', 'error_message');
  }
};
