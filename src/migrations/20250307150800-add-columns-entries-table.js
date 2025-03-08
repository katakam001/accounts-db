'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.addColumn('entries', 'invoiceNumber', {
        type: Sequelize.STRING,
        allowNull: false,
      });
  
      await queryInterface.addColumn('entries', 'category_account_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'account_list', // Adjust if your account table has a different name
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    },
  
    down: async (queryInterface, Sequelize) => {
      await queryInterface.removeColumn('entries', 'invoiceNumber');
      await queryInterface.removeColumn('entries', 'category_account_id');
    }
};
  
