module.exports = (sequelize, Sequelize, Category, Units) => {
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
        model: Category,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    unit_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Units,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
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
    tableName: 'category_units',
  });

  return CategoryUnits;
};
