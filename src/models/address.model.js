module.exports = (sequelize, Sequelize) => {
    const Address = sequelize.define("Address", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        account_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        street: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        city: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        state: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        postal_code: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        country: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
    }, {
        tableName: 'addresses',
    });
    return Address;
};
