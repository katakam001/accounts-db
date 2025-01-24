module.exports = (sequelize, Sequelize,Items,Units) => {
    const RawItem = sequelize.define("RawItem", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        item_id: {
            type: Sequelize.INTEGER,
            references: {
                model: Items,
                key: 'id',
            },
        },
        unit_id: {
            type: Sequelize.INTEGER,
            references: {
                model: Units,
                key: 'id',
            },
        },
        user_id: {
            type: Sequelize.INTEGER,
        },
        financial_year: {
            type: Sequelize.STRING(10),
            allowNull: false,
        },
    }, {
        tableName: 'raw_items',
    });
    return RawItem;
};
