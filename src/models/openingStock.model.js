module.exports = (sequelize, Sequelize, Items) => {
    const OpeningStock = sequelize.define("opening_stock", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        item_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: Items,
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        },
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: true
        },
        financial_year: {
            type: Sequelize.STRING,
            allowNull: false
        },
        quantity: {
            type: Sequelize.DECIMAL(10, 4),
            allowNull: true,
        },
        rate: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
        },
        value: {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: true,
        }
    }, {
        tableName: 'opening_stock'
    });

    return OpeningStock;
};
