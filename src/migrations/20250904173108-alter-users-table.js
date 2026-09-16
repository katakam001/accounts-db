'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove unused columns
    await queryInterface.removeColumn('users', 'firstname');
    await queryInterface.removeColumn('users', 'middlename');
    await queryInterface.removeColumn('users', 'lastname');
    await queryInterface.removeColumn('users', 'type');

    // Add new fields
    await queryInterface.addColumn('users', 'contact_number', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('users', 'is_email_verified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await queryInterface.addColumn('users', 'is_contact_verified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await queryInterface.addColumn('users', 'is_profile_completed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert changes
    await queryInterface.addColumn('users', 'firstname', {
      type: Sequelize.STRING(250),
      allowNull: false
    });

    await queryInterface.addColumn('users', 'middlename', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('users', 'lastname', {
      type: Sequelize.STRING(250),
      allowNull: false
    });

    await queryInterface.addColumn('users', 'type', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.removeColumn('users', 'contact_number');
    await queryInterface.removeColumn('users', 'is_email_verified');
    await queryInterface.removeColumn('users', 'is_contact_verified');
    await queryInterface.removeColumn('users', 'is_profile_completed');

  }
};
