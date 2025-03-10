'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    up: async (queryInterface, Sequelize) => {
    // Rename column 'description' to 'gst_no' and set its max size to 20 characters
    await queryInterface.renameColumn('account_list', 'description', 'gst_no');
    await queryInterface.changeColumn('account_list', 'gst_no', {
      type: Sequelize.STRING(20), // Set maximum size to 20 characters
      allowNull: true // Adjust based on whether null values are allowed
    });
  },

    down: async (queryInterface, Sequelize) => {
    // Revert the column name back to 'description'
    await queryInterface.renameColumn('account_list', 'gst_no', 'description');
    // Revert the column size to its original configuration
    await queryInterface.changeColumn('account_list', 'description', {
      type: Sequelize.STRING, // Use the original type and size
      allowNull: true // Adjust to match the original settings
    });
  }
};
