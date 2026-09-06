'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // uploaded_file_log table
    await queryInterface.changeColumn('uploaded_file_log', 'transaction_id', {
      type: Sequelize.STRING(68),
      allowNull: false,
    });

    // message_tracking_log table
    await queryInterface.changeColumn('message_tracking_log', 'transaction_id', {
      type: Sequelize.STRING(68),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // rollback to original size (64)

    await queryInterface.changeColumn('uploaded_file_log', 'transaction_id', {
      type: Sequelize.STRING(64),
      allowNull: false,
    });

    await queryInterface.changeColumn('message_tracking_log', 'transaction_id', {
      type: Sequelize.STRING(64),
      allowNull: false,
    });
  }
};
