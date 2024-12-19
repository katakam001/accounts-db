module.exports = (sequelize, Sequelize, PurchaseCategories) => {
  const PurchaseFields = sequelize.define("PurchaseFields", {
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
        model: PurchaseCategories,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    field_name: {
      type: Sequelize.STRING,
      allowNull: false
    },
    field_type: {
      type: Sequelize.STRING,
      allowNull: false
    },
    required: {
      type: Sequelize.BOOLEAN,
      allowNull: false
    },
    field_category: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0 // Default to Normal
    },
    exclude_from_total: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'purchase_fields',
  });

  return PurchaseFields;
};
