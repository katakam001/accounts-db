'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // cash_entries_batch table
    await queryInterface.changeColumn('cash_entries_batch', 'transaction_id', {
      type: Sequelize.STRING(68),
      allowNull: true,
    });

    // journal_entries table
    await queryInterface.changeColumn('journal_entries', 'transaction_id', {
      type: Sequelize.STRING(68),
      allowNull: true,
    });

    // cash_entries table
    await queryInterface.changeColumn('cash_entries', 'transaction_id', {
      type: Sequelize.STRING(68),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // rollback to original size
    await queryInterface.changeColumn('cash_entries_batch', 'transaction_id', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });

    await queryInterface.changeColumn('journal_entries', 'transaction_id', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });

    await queryInterface.changeColumn('cash_entries', 'transaction_id', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
  }
};
