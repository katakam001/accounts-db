module.exports = (sequelize, Sequelize) => {
  const PurchaseCategories = sequelize.define("PurchaseCategories", {
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
    tableName: 'purchase_categories',
  });

  return PurchaseCategories;
};
