module.exports = (sequelize, Sequelize,PurchaseCategory,Units) => {
  const CategoryUnits = sequelize.define('CategoryUnits', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER
    },
    category_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: PurchaseCategory,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    unit_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Units,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    }
  }, {
    tableName: 'category_units',
  });

  return CategoryUnits;
};