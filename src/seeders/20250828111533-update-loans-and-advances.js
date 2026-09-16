'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(sequelize, Sequelize) {
    // Remove loans & Advances (Asset) mapping rule

    await sequelize.bulkDelete('mapping_rules', {
      source: 'Loans & Advances (Asset)',
      statement_type: 0,
      statement_provider: 'lint'
    });
    // Add new loans & Advances (Asset) mapping rule

    await sequelize.bulkInsert('mapping_rules', [
      {
        source: 'Loans & Advances (Asset)',
        target: 'Loans and Advances',
        type: 0,
        statement_type: 0,
        statement_provider: 'lint',
        amount_mandatory: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(sequelize, Sequelize) {
    // revert loans & Advances (Asset) mapping rule

    await sequelize.bulkDelete('mapping_rules', {
      source: 'Loans & Advances (Asset)',
      statement_type: 0,
      statement_provider: 'lint'
    });

    // Revert new loans & Advances (Asset) mapping rule

    await sequelize.bulkInsert('mapping_rules', [
      {
        source: 'Loans & Advances (Asset)',
        target: 'Loans & Advances',
        type: 0,
        statement_type: 0,
        statement_provider: 'lint',
        amount_mandatory: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  }
};
