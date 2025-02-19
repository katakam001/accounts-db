module.exports = (sequelize, Sequelize,Users) => {
    const AdminUser = sequelize.define("AdminUser", {
      admin_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: Users,
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: Users,
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      }
    }, {
      tableName: 'admin_users',
    });
  
    return AdminUser;
  };
  