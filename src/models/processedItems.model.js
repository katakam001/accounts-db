module.exports = (sequelize, Sequelize, RawItems, Items, Units, Conversions) => {
    const ProcessedItem = sequelize.define("ProcessedItem", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      raw_item_id: {
        type: Sequelize.INTEGER,
        references: {
          model: RawItems,
          key: 'id',
        },
      },
      item_id: {
        type: Sequelize.INTEGER,
        references: {
          model: Items,
          key: 'id',
        },
      },
      unit_id: {
        type: Sequelize.INTEGER,
        references: {
          model: Units,
          key: 'id',
        },
      },
      percentage: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      conversion_id: {
        type: Sequelize.INTEGER,
        references: {
          model: Conversions,
          key: 'id',
        },
      },
      user_id: {
        type: Sequelize.INTEGER,
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
    }, {
      tableName: 'processed_items',
    });
  
    return ProcessedItem;
  };
  