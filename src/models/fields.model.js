module.exports = (sequelize, Sequelize) => {
  const Fields = sequelize.define("Fields", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER
    },
    field_name: {
      type: Sequelize.STRING,
      allowNull: false
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    financial_year: {
      type: Sequelize.STRING(10),
      allowNull: true,
    }
  }, {
    tableName: 'fields',
  });

  return Fields;
};
