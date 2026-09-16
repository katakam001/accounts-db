'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add deleted_count column to copy_job_tables
    await queryInterface.addColumn('copy_job_tables', 'deleted_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove deleted_count column if rolling back
    await queryInterface.removeColumn('copy_job_tables', 'deleted_count');
  }
};
