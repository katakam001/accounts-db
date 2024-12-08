module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define("users", {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    firstname: {
      type: Sequelize.STRING(250),
      allowNull: false
    },
    middlename: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    lastname: {
      type: Sequelize.STRING(250),
      allowNull: false
    },
    username: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    password: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    last_login: {
      type: Sequelize.DATE,
      allowNull: true
    },
    type: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    status: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false
    }
  });

  return User;
};
