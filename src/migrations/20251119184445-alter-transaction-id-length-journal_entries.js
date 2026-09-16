'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Change transaction_id column to varchar(64)
    await queryInterface.changeColumn('journal_entries', 'transaction_id', {
      type: Sequelize.STRING(64),
      allowNull: true   // keep same nullability as original definition
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert transaction_id column back to varchar(30)
    await queryInterface.changeColumn('journal_entries', 'transaction_id', {
      type: Sequelize.STRING(30),
      allowNull: true
    });
  }
};
