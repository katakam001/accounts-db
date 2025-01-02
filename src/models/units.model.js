module.exports = (sequelize, Sequelize) => {
  const Units = sequelize.define("Units", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER
    },
    name: {
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
    tableName: 'units',
  });

  return Units;
};
