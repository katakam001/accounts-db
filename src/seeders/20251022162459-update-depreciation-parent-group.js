'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'default_group_mapping',
      { parent_name: 'Profit & Loss A/C' }, // ✅ new parent
      {
        parent_name: 'Trading Account',
        group_name: 'Depreciation',
        hierarchy_level: 2
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // Optional rollback: revert back to Trading Account
    await queryInterface.bulkUpdate(
      'default_group_mapping',
      { parent_name: 'Trading Account' },
      {
        parent_name: 'Profit & Loss A/C',
        group_name: 'Depreciation',
        hierarchy_level: 2
      }
    );
  }
};
