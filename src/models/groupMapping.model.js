module.exports = (sequelize, Sequelize, GroupMappings, Group) => {
    const GroupMapping = sequelize.define("GroupMapping", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        parent_id: {
            type: Sequelize.INTEGER,
            references: {
                model: GroupMappings,
                key: 'id',
            },
        },
        group_id: {
            type: Sequelize.INTEGER,
            references: {
                model: Group, // Reference to the group_list table
                key: 'id',
            },
        },
        user_id: {
            type: Sequelize.INTEGER,
        },
        financial_year: {
            type: Sequelize.STRING,
            allowNull: false,
        },
    }, {
        tableName: 'group_mapping'
    });
    return GroupMapping;
};
