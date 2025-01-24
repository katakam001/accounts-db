'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(sequelize, Sequelize) {

        await sequelize.createTable('user_roles', {
            roleId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'roles', // Make sure this matches the table name of the Roles model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users', // Make sure this matches the table name of the Users model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
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
        // Create the 'conversions' table
        await sequelize.createTable('conversions', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            from_unit_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'units', // Make sure this matches the table name of the Units model
                    key: 'id'
                }
            },
            to_unit_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'units', // Make sure this matches the table name of the Units model
                    key: 'id'
                }
            },
            rate: {
                type: Sequelize.FLOAT,
                allowNull: false
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            financial_year: {
                type: Sequelize.STRING(10),
                allowNull: false
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

        // Create the 'account_group' table
        await sequelize.createTable('account_group', {
            account_id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                references: {
                    model: 'account_list', // Make sure this matches the table name of the Account model
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            group_id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                references: {
                    model: 'group_list', // Make sure this matches the table name of the Group model
                    key: 'id'
                },
                onDelete: 'CASCADE'
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

        // Create the 'addresses' table
        await sequelize.createTable('addresses', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            account_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            street: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            city: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            state: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            postal_code: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            country: {
                type: Sequelize.TEXT,
                allowNull: false,
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

        // Create the 'cash_entries' table
        await sequelize.createTable('cash_entries', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            cash_date: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            narration: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            account_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_list', // Make sure this matches the table name of the Account model
                    key: 'id'
                }
            },
            type: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
            },
            amount: {
                type: Sequelize.FLOAT,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
            },
            financial_year: {
                type: Sequelize.STRING,
                allowNull: false,
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

        await sequelize.createTable('category_units', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            category_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'categories', // Make sure this matches the table name of the Category model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            unit_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'units', // Make sure this matches the table name of the Units model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            financial_year: {
                type: Sequelize.STRING(10),
                allowNull: true,
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

        await sequelize.createTable('journal_entries', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false,
            },
            journal_date: {
                type: Sequelize.DATE,
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            financial_year: {
                type: Sequelize.STRING,
                allowNull: false
            },
            type: {
                type: Sequelize.INTEGER,
                allowNull: false
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

        await sequelize.createTable('journal_items', {
            journal_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'journal_entries', // Make sure this matches the table name of the JournalEntry model
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            account_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_list', // Make sure this matches the table name of the Account model
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            group_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'group_list', // Make sure this matches the table name of the Group model
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            amount: {
                type: Sequelize.FLOAT,
                defaultValue: 0,
                allowNull: false
            },
            type: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
                allowNull: false
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

        await sequelize.createTable('entries', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            category_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'categories', // Make sure this matches the table name of the Category model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            entry_date: {
                type: Sequelize.DATE,
                allowNull: false
            },
            account_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'account_list', // Make sure this matches the table name of the Account model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            item_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'items', // Make sure this matches the table name of the Items model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            quantity: {
                type: Sequelize.NUMERIC,
                allowNull: true
            },
            unit_price: {
                type: Sequelize.NUMERIC,
                allowNull: true
            },
            total_amount: {
                type: Sequelize.NUMERIC,
                allowNull: true
            },
            value: {
                type: Sequelize.DECIMAL(20, 2),
                allowNull: true
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            financial_year: {
                type: Sequelize.STRING,
                allowNull: false
            },
            unit_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'units', // Make sure this matches the table name of the Units model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            journal_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'journal_entries', // Make sure this matches the table name of the JournalEntry model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            type: {
                type: Sequelize.INTEGER,
                allowNull: false
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

        await sequelize.createTable('entry_fields', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            entry_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'entries', // Make sure this matches the table name of the Entry model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            field_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'fields', // Make sure this matches the table name of the Fields model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            field_value: {
                type: Sequelize.TEXT,
                allowNull: false
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

        await sequelize.createTable('fields_mapping', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            category_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'categories', // Make sure this matches the table name of the Categories model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            field_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'fields', // Make sure this matches the table name of the Fields model
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            field_type: {
                type: Sequelize.STRING,
                allowNull: false
            },
            required: {
                type: Sequelize.BOOLEAN,
                allowNull: false
            },
            field_category: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0 // Default to Normal
            },
            exclude_from_total: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            type: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            financial_year: {
                type: Sequelize.STRING(10),
                allowNull: true,
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

        await sequelize.createTable('raw_items', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            item_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'items', // Make sure this matches the table name of the Items model
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            unit_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'units', // Make sure this matches the table name of the Units model
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
            },
            financial_year: {
                type: Sequelize.STRING(10),
                allowNull: false,
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

        await sequelize.createTable('processed_items', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            raw_item_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'raw_items', // Make sure this matches the table name of the RawItems model
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            item_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'items', // Make sure this matches the table name of the Items model
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            unit_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'units', // Make sure this matches the table name of the Units model
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            percentage: {
                type: Sequelize.FLOAT,
                allowNull: false,
            },
            conversion_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'conversions', // Make sure this matches the table name of the Conversions model
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
            },
            financial_year: {
                type: Sequelize.STRING(10),
                allowNull: false,
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

        await sequelize.createTable('production_entries', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            raw_item_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'items', // Make sure this matches the table name of the Items model
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            item_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'items', // Make sure this matches the table name of the Items model
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            unit_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'units', // Make sure this matches the table name of the Units model
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            production_date: {
                type: Sequelize.DATE,
            },
            quantity: {
                type: Sequelize.DECIMAL(10, 2),
            },
            percentage: {
                type: Sequelize.FLOAT,
                allowNull: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
            },
            financial_year: {
                type: Sequelize.STRING(10),
                allowNull: false,
            },
            conversion_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'conversions', // Make sure this matches the table name of the Conversions model
                    key: 'id',
                },
                allowNull: true,
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            production_entry_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'production_entries', // Make sure this matches the table name of the ProductionEntries model
                    key: 'id',
                },
                allowNull: true,
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

        await sequelize.createTable('group_mapping', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            parent_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'group_mapping', // Make sure this matches the table name of the GroupMappings model
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            group_id: {
                type: Sequelize.INTEGER,
                references: {
                    model: 'group_list', // Make sure this matches the table name of the Group model
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
    },

    async down(sequelize, Sequelize) {


        // Drop the 'account_group' table
        await sequelize.dropTable('user_roles');
        // Drop the 'account_group' table
        await sequelize.dropTable('account_group');

        // Drop the 'addresses' table
        await sequelize.dropTable('addresses');

        // Drop the 'cash_entries' table
        await sequelize.dropTable('cash_entries');

        // Drop the 'category_units' table
        await sequelize.dropTable('category_units');

        // Drop the 'journal_items' table
        await sequelize.dropTable('journal_items');

        // Drop the 'entry_fields' table
        await sequelize.dropTable('entry_fields');

        // Drop the 'entries' table
        await sequelize.dropTable('entries');

        // Drop the 'journal_entries' table
        await sequelize.dropTable('journal_entries');

        // Drop the 'fields_mapping' table
        await sequelize.dropTable('fields_mapping');

        // Drop the 'processed_items' table
        await sequelize.dropTable('processed_items');

        // Drop the 'raw_items' table
        await sequelize.dropTable('raw_items');

        // Drop the 'production_entries' table
        await sequelize.dropTable('production_entries');

        // Drop the 'group_mapping' table
        await sequelize.dropTable('group_mapping');

        // Drop the 'conversions' table
        await sequelize.dropTable('conversions');
    }
};
