module.exports = (sequelize, Sequelize) => {
    const Group = sequelize.define("Group", {
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
        financial_year: {
            type: Sequelize.STRING,
            allowNull: false,
        },
    }, {
        tableName: 'group_list',
    });

    return Group;
};
