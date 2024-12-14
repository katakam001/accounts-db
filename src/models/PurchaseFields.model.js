module.exports = (sequelize, Sequelize,PurchaseCategories) => {
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
        }
      }, {
        tableName: 'purchase_fields',
    });

    return PurchaseFields;
};
