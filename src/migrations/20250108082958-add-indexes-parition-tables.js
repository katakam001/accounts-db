'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(sequelize, Sequelize) {
        // Add indexes
        await sequelize.addIndex('stock_register', ['entry_date'], {
            name: 'idx_stock_register_entry_date',
            using: 'BTREE'
        });
        await sequelize.addIndex('stock_register', ['financial_year'], {
            name: 'idx_stock_register_financial_year',
            using: 'BTREE'
        });
        await sequelize.addIndex('stock_register', ['item_id'], {
            name: 'idx_stock_register_item_id',
            using: 'BTREE'
        });
        await sequelize.addIndex('stock_register', ['user_id'], {
            name: 'idx_stock_register_user_id',
            using: 'BTREE'
        });
    },

    async down(sequelize, Sequelize) {
        // Remove indexes
        await sequelize.removeIndex('stock_register', 'idx_stock_register_entry_date');
        await sequelize.removeIndex('stock_register', 'idx_stock_register_financial_year');
        await sequelize.removeIndex('stock_register', 'idx_stock_register_item_id');
        await sequelize.removeIndex('stock_register', 'idx_stock_register_user_id');
    }
};
