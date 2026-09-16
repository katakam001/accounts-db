'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Change transaction_id column to varchar(64) in both tables
    await queryInterface.changeColumn('message_tracking_log', 'transaction_id', {
      type: Sequelize.STRING(64),
      allowNull: false
    });

    await queryInterface.changeColumn('uploaded_file_log', 'transaction_id', {
      type: Sequelize.STRING(64),
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert transaction_id column back to varchar(50) in both tables
    await queryInterface.changeColumn('message_tracking_log', 'transaction_id', {
      type: Sequelize.STRING(50),
      allowNull: false
    });

    await queryInterface.changeColumn('uploaded_file_log', 'transaction_id', {
      type: Sequelize.STRING(50),
      allowNull: false
    });
  }
};
