'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(sequelize, Sequelize) {
    // Create default_account_list table
    await sequelize.createTable('seeder_logs', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        seeder_file_name: {
          type: Sequelize.STRING,
          unique: true,
          allowNull: false,
        },
        executed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    },
  
    async down(sequelize, Sequelize) {
        await sequelize.dropTable('seeder_logs');
    },
  };
  