'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('fields_mapping', 'account_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'account_list', // Make sure this matches the table name of the Account model
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('fields_mapping', 'account_id');
    }
};

