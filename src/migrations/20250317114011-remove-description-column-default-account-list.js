'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the `description` column from `default_account_list`
    await queryInterface.removeColumn('default_account_list', 'description');
  },

  async down(queryInterface, Sequelize) {
    // Add the `description` column back to `default_account_list` in case of rollback
    await queryInterface.addColumn('default_account_list', 'description', {
      type: Sequelize.STRING, // Assuming the column was of type STRING, adjust if necessary
      allowNull: true,
    });
  },
};
