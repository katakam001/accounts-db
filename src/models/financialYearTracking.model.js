module.exports = (sequelize, Sequelize) => {
    const FinancialYearTracking = sequelize.define("FinancialYearTracking", {
        user_id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            allowNull: false,
        },
        financial_year: {
            type: Sequelize.STRING(10),
            primaryKey: true,
            allowNull: false,
        },
    }, {
        tableName: 'financial_year_tracking',
    });

    return FinancialYearTracking;
};