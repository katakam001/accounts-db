module.exports = (sequelize, Sequelize) => {
    const Item = sequelize.define("Item", {
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
        },
        financial_year: {
            type: Sequelize.STRING(10),
            allowNull: false,
        },
    }, {
        tableName: 'items',
    });
    return Item;
};
