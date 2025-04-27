module.exports = (sequelize, Sequelize, Account, Group, JournalEntry) => {
    const JournalItem = sequelize.define("JournalItem", {
        journal_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: JournalEntry,
                key: 'id'
            },
            onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
            onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
        },
        account_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: Account,
                key: 'id'
            },
            onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
            onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
        },
        group_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: Group,
                key: 'id'
            },
            onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
            onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
        },
        amount: {
            type: Sequelize.DECIMAL(15, 2), // Updated to NUMERIC(10, 2)
            defaultValue: 0,
            allowNull: false
        },
        type: {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        narration: {
            type: Sequelize.TEXT,
            allowNull: true,
        }
    }, {
        tableName: 'journal_items',
    });

    return JournalItem;
};
