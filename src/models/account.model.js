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
        gst_no: {
            type: Sequelize.STRING(20),
            allowNull: true,
        },
        user_id: {
            type: Sequelize.INTEGER,
        },
        credit_balance: {
            type: Sequelize.DECIMAL(15, 2),
            defaultValue: 0,
            allowNull: false,
        },
        debit_balance: {
            type: Sequelize.DECIMAL(15, 2),
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
    }, {
        tableName: 'account_list',
    });

    return Account;
};
