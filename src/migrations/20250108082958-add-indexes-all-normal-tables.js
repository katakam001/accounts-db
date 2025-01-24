'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(sequelize, Sequelize) {
        // Add indexes
        await sequelize.addIndex('conversions', ['from_unit_id'], {
            name: 'idx_conversions_from_unit_id',
            using: 'BTREE'
        });
        await sequelize.addIndex('conversions', ['to_unit_id'], {
            name: 'idx_conversions_to_unit_id',
            using: 'BTREE'
        });
        await sequelize.addIndex('entries', ['entry_date'], {
            name: 'idx_entries_entry_date',
            using: 'BTREE'
        });
        await sequelize.addIndex('entries', ['item_id'], {
            name: 'idx_entries_item_id',
            using: 'BTREE'
        });
        await sequelize.addIndex('entries', ['user_id', 'financial_year', 'type'], {
            name: 'idx_entries_user_financial_year_type',
            using: 'BTREE'
        });
        await sequelize.addIndex('fields_mapping', ['category_id', 'type'], {
            name: 'idx_fields_mapping_category_type',
            using: 'BTREE'
        });
        await sequelize.addIndex('fields_mapping', ['type'], {
            name: 'idx_fields_mapping_type',
            using: 'BTREE'
        });
        await sequelize.addIndex('items', ['name'], {
            name: 'idx_items_name',
            using: 'BTREE'
        });
        await sequelize.addIndex('processed_items', ['item_id'], {
            name: 'idx_processed_items_item_id',
            using: 'BTREE'
        });
        await sequelize.addIndex('processed_items', ['raw_item_id'], {
            name: 'idx_processed_items_raw_item_id',
            using: 'BTREE'
        });
        await sequelize.addIndex('processed_items', ['unit_id'], {
            name: 'idx_processed_items_unit_id',
            using: 'BTREE'
        });
        await sequelize.addIndex('production_entries', ['item_id'], {
            name: 'idx_production_entries_item_id',
            using: 'BTREE'
        });
        await sequelize.addIndex('production_entries', ['production_date'], {
            name: 'idx_production_entries_production_date',
            using: 'BTREE'
        });
        await sequelize.addIndex('production_entries', ['raw_item_id'], {
            name: 'idx_production_entries_raw_item_id',
            using: 'BTREE'
        });
        await sequelize.addIndex('production_entries', ['user_id', 'financial_year'], {
            name: 'idx_production_entries_user_financial_year',
            using: 'BTREE'
        });
        await sequelize.addIndex('raw_items', ['item_id'], {
            name: 'idx_raw_items_item_id',
            using: 'BTREE'
        });
        await sequelize.addIndex('raw_items', ['unit_id'], {
            name: 'idx_raw_items_unit_id',
            using: 'BTREE'
        });
    },

    async down(sequelize, Sequelize) {
        // Remove indexes
        await sequelize.removeIndex('conversions', 'idx_conversions_from_unit_id');
        await sequelize.removeIndex('conversions', 'idx_conversions_to_unit_id');
        await sequelize.removeIndex('entries', 'idx_entries_entry_date');
        await sequelize.removeIndex('entries', 'idx_entries_item_id');
        await sequelize.removeIndex('entries', 'idx_entries_user_financial_year_type');
        await sequelize.removeIndex('fields_mapping', 'idx_fields_mapping_category_type');
        await sequelize.removeIndex('fields_mapping', 'idx_fields_mapping_type');
        await sequelize.removeIndex('items', 'idx_items_name');
        await sequelize.removeIndex('processed_items', 'idx_processed_items_item_id');
        await sequelize.removeIndex('processed_items', 'idx_processed_items_raw_item_id');
        await sequelize.removeIndex('processed_items', 'idx_processed_items_unit_id');
        await sequelize.removeIndex('production_entries', 'idx_production_entries_item_id');
        await sequelize.removeIndex('production_entries', 'idx_production_entries_production_date');
        await sequelize.removeIndex('production_entries', 'idx_production_entries_raw_item_id');
        await sequelize.removeIndex('production_entries', 'idx_production_entries_user_financial_year');
        await sequelize.removeIndex('raw_items', 'idx_raw_items_item_id');
        await sequelize.removeIndex('raw_items', 'idx_raw_items_unit_id');
    }
};
