module.exports = (sequelize, Sequelize, Categories, Fields) => {
  const FieldsMapping = sequelize.define("FieldsMapping", {
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
        model: Categories,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    field_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Fields,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
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
    },
    type: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'fields_mapping',
  });

  return FieldsMapping;
};
