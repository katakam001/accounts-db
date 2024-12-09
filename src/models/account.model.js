module.exports = (sequelize, Sequelize) => {
    const Account = sequelize.define("Account", {
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
        balance: {
            type: Sequelize.FLOAT,
            defaultValue: 0,
            allowNull: false,
        },
        financial_year: {
            type: Sequelize.STRING,
            allowNull: false,
        },
    }, {
        tableName: 'account_list',
    });

    return Account;
};
