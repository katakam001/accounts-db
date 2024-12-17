// models/accountGroup.js
module.exports = (sequelize, Sequelize,Account,Group) => {
    const AccountGroup = sequelize.define('AccountGroup', {
      account_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: Account,
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      group_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: Group,
          key: 'id'
        },
        onDelete: 'CASCADE'
    },
}, {
    tableName: 'account_group',
});

return AccountGroup;
};
  