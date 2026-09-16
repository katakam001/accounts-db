'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Composite index for audit table
    await queryInterface.addIndex('copy_job_audit', ['job_id', 'table_name', 'source_id'], {
      name: 'idx_audit_job_table_source'
    });

    await queryInterface.addIndex('copy_job_audit', ['job_id', 'table_name', 'target_id'], {
      name: 'idx_audit_job_table_target'
    });

    // Composite index for cash_sale_entries
    await queryInterface.addIndex('cash_sale_entries', ['user_id', 'financial_year', 'entry_date'], {
      name: 'idx_cash_sale_entries_user_year_date'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('copy_job_audit', 'idx_audit_job_table_source');
    await queryInterface.removeIndex('copy_job_audit', 'idx_audit_job_table_target');
    await queryInterface.removeIndex('cash_sale_entries', 'idx_cash_sale_entries_user_year_date');
  }
};
