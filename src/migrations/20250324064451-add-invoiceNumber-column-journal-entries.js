'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('journal_entries', 'invoiceNumber', {
      type: Sequelize.STRING,
      allowNull: true, // Allow null values
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('journal_entries', 'invoiceNumber');
  },
};
