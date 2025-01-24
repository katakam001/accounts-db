'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(sequelize, Sequelize) {

        await sequelize.createTable('units', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING,
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
        await sequelize.createTable('roles', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            name: {
                type: Sequelize.STRING
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

        await sequelize.createTable('users', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            firstname: {
                type: Sequelize.STRING(250),
                allowNull: false
            },
            middlename: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            lastname: {
                type: Sequelize.STRING(250),
                allowNull: false
            },
            username: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            password: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            last_login: {
                type: Sequelize.DATE,
                allowNull: true
            },
            type: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            status: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            loginAttempts: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            email: {
                type: Sequelize.STRING,
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
        await sequelize.createTable('items', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
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
        await sequelize.createTable('categories', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
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

        await sequelize.createTable('group_list', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            description: {
                type: Sequelize.TEXT,
            },
            user_id: {
                type: Sequelize.INTEGER,
            },
            credit_balance: {
                type: Sequelize.FLOAT,
                defaultValue: 0,
                allowNull: false,
            },
            debit_balance: {
                type: Sequelize.FLOAT,
                defaultValue: 0,
                allowNull: false,
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

        // Create the 'account_list' table
        await sequelize.createTable('account_list', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            description: {
                type: Sequelize.TEXT,
            },
            user_id: {
                type: Sequelize.INTEGER,
            },
            credit_balance: {
                type: Sequelize.FLOAT,
                defaultValue: 0,
                allowNull: false,
            },
            debit_balance: {
                type: Sequelize.FLOAT,
                defaultValue: 0,
                allowNull: false,
            },
            financial_year: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            isDealer: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            type: {
                type: Sequelize.INTEGER
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

        // Create the 'areas' table
        await sequelize.createTable('areas', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
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

        // Create the 'fields' table
        await sequelize.createTable('fields', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            field_name: {
                type: Sequelize.STRING,
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

        // Create the 'brokers' table
        await sequelize.createTable('brokers', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            contact: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            email: {
                type: Sequelize.STRING,
                allowNull: true, // Allow null values
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

    },

    async down(sequelize, Sequelize) {

        // Drop the 'units' table
        await sequelize.dropTable('units');

        // Drop the 'roles' table
        await sequelize.dropTable('roles');

        // Drop the 'users' table
        await sequelize.dropTable('users');

        // Drop the 'items' table
        await sequelize.dropTable('items');

        // Drop the 'fields' table
        await sequelize.dropTable('fields');

        // Drop the 'categories' table
        await sequelize.dropTable('categories');

        // Drop the 'group_list' table
        await sequelize.dropTable('group_list');

        // Drop the 'account_list' table
        await sequelize.dropTable('account_list');

        // Drop the 'areas' table
        await sequelize.dropTable('areas');

        // Drop the 'brokers' table
        await sequelize.dropTable('brokers');

    }
};
