module.exports = (sequelize, Sequelize, Categories) => {
  const Fields = sequelize.define("Fields", {
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
    },
    type: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'fields',
  });

  return Fields;
};
