'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('exports', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      file_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      status: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      input_key: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      input_key_timestamp: {
        type: Sequelize.DATE,
        allowNull: true
      },
      output_key: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      output_key_timestamp: {
        type: Sequelize.DATE,
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('exports');
  }
};
