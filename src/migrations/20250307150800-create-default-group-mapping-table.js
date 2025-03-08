'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(sequelize, Sequelize) {
        // Create default_group_mapping table with hierarchy_level column
        await sequelize.createTable('default_group_mapping', {
            parent_name: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            group_name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            hierarchy_level: {
                type: Sequelize.INTEGER,
                allowNull: false, // Set to false if hierarchy_level is mandatory
            },
        });
    },

    async down(sequelize, Sequelize) {
        // Drop the table
        await sequelize.dropTable('default_group_mapping');
    },
};
