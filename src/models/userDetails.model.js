module.exports = (sequelize, Sequelize,Users) => {
  const UserDetails = sequelize.define("user_details", {
    user_id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      references: {
        model: Users,
        key: "id"
      },
      onDelete: "CASCADE"
    },
    company_name: {
      type: Sequelize.STRING,
      allowNull: false
    },
    owner_name: {
      type: Sequelize.STRING,
      allowNull: false
    },
    user_type: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    pan_number: {
      type: Sequelize.STRING,
      allowNull: false
    },
    gst_number: {
      type: Sequelize.STRING,
      allowNull: false
    },
    city: {
      type: Sequelize.STRING,
      allowNull: false
    },
    jurisdiction: {
      type: Sequelize.STRING,
      allowNull: true
    }
  });

  return UserDetails;
};
