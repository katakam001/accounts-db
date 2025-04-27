module.exports = (sequelize, Sequelize, Items, Units) => {
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
            onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
            onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
        },
        unit_id: {
            type: Sequelize.INTEGER,
            references: {
                model: Units,
                key: 'id',
            },
            onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
            onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
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
