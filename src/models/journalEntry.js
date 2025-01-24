module.exports = (sequelize, Sequelize) => {
    const JournalEntry = sequelize.define("JournalEntry", {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
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
        }
    }, {
        tableName: 'journal_entries',
    });

    return JournalEntry;
};

