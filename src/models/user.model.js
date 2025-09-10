module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define("users", {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    username: {
      type: Sequelize.TEXT,
      allowNull: false,
      unique: true
    },
    password: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    },
    contact_number: {
      type: Sequelize.STRING,
      allowNull: true
    },
    is_email_verified: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    is_contact_verified: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    last_login: {
      type: Sequelize.DATE,
      allowNull: true
    },
    status: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    loginAttempts: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    is_profile_completed: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    }
  });

  return User;
};
