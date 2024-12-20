module.exports = (sequelize, Sequelize) => {
  const Categories = sequelize.define("Categories", {
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
    type: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'categories',
  });

  return Categories;
};
