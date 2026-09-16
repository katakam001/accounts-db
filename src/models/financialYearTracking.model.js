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
        status: {
            type: Sequelize.INTEGER, // 1 = default seeded, 2 = carry-forward in progress, 3 = ready, etc.
            allowNull: false,
            defaultValue: 1
        },
        error_message: {
            type: Sequelize.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'financial_year_tracking'
    });

    return FinancialYearTracking;
};
