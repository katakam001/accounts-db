'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(sequelize, Sequelize) {
    // Create default_account_list table
    await sequelize.createTable('admin_users', {
      admin_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create financial_year_tracking table
    await sequelize.createTable('financial_year_tracking', {
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false,
        primaryKey: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(sequelize, Sequelize) {
    // Drop tables in reverse order
    await sequelize.dropTable('financial_year_tracking');
    await sequelize.dropTable('admin_users');
  }
};
