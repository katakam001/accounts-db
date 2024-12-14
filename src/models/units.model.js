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
    }
  }, {
    tableName: 'units',
  });

  return Units;
};
