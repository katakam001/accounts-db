'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(sequelize, Sequelize) {
    await sequelize.bulkInsert('mapping_rules', [
      { source: 'Loans & Advances (Asset)', target: 'Loans & Advances', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Expenses (Direct)', target: 'Direct Expenses', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: false, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Cash-In-Hand', target: 'Cash On Hand', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Suspend Acount', target: 'Suspense', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Stock-in-Hand', target: 'Stock In Hand', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Suspence', target: 'Suspense Account', type: 1, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Suspense', target: 'Suspense Account', type: 1, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Purchase Account', target: 'Purchase Account', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: false, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Sales Account', target: 'Sale Account', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: false, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Closing Stock', target: 'Closing Stock', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: false, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Opening Stock', target: 'Opening Stock', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: false, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Deposits (Asset)', target: 'Deposits', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Cash on Hand A/c', target: 'CASH', type: 1, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Cash On Hand A/c.', target: 'CASH', type: 1, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Cash In Hand', target: 'CASH', type: 1, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() },
      { source: 'Loans (Liabiliities)', target: 'Unsecured Loans', type: 0, statement_type: 0, statement_provider: 'lint', amount_mandatory: true, createdAt: new Date(), updatedAt: new Date() }
    ]);
  },

  async down(sequelize, Sequelize) {
    await sequelize.bulkDelete('mapping_rules', {
      source: {
        [Sequelize.Op.in]: [
          'Loans & Advances (Asset)',
          'Expenses (Direct)',
          'Cash-In-Hand',
          'Suspend Acount',
          'Stock-in-Hand',
          'Suspence',
          'Suspense',
          'Purchase Account',
          'Sales Account',
          'Closing Stock',
          'Opening Stock',
          'Deposits (Asset)',
          'Cash on Hand A/c',
          'Cash On Hand A/c.',
          'Cash In Hand',
          'Loans (Liabiliities)'
        ]
      },
      statement_type: 0,
      statement_provider: 'lint'
    });
  }

};
