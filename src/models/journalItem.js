module.exports = (sequelize, Sequelize, Account, Group, JournalEntry) => {
    const JournalItem = sequelize.define("JournalItem", {
        journal_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: JournalEntry,
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        account_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: Account,
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        group_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: Group,
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
    }, {
        tableName: 'journal_items',
    });

    return JournalItem;
};
