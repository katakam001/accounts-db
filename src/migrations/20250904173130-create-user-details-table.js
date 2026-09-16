'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_details', {
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      company_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      owner_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      user_type: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0 // 0 = Proprietor, 1 = Managing Partner, etc.
      },
      pan_number: {
        type: Sequelize.STRING,
        allowNull: false
      },
      gst_number: {
        type: Sequelize.STRING,
        allowNull: false
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false
      },
      jurisdiction: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('user_details', ['pan_number']);
    await queryInterface.addIndex('user_details', ['gst_number']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_details');
  }
};
