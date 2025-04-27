module.exports = (sequelize, Sequelize, Items, Units, Conversions,ProductionEntries) => {
  const ProductionEntry = sequelize.define("ProductionEntry", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    raw_item_id: {
      type: Sequelize.INTEGER,
      references: {
        model: Items,
        key: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    },
    item_id: {
      type: Sequelize.INTEGER,
      references: {
        model: Items,
        key: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    },
    unit_id: {
      type: Sequelize.INTEGER,
      references: {
        model: Units,
        key: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
    },
    production_date: {
      type: Sequelize.DATE,
    },
    quantity: {
      type: Sequelize.DECIMAL(10, 2),
    },
    percentage: {
      type: Sequelize.FLOAT,
      allowNull: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
    },
    financial_year: {
      type: Sequelize.STRING(10),
      allowNull: false,
    },
    conversion_id: {
      type: Sequelize.INTEGER,
      references: {
        model: Conversions,
        key: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
      allowNull: true,
    },
    production_entry_id: {
      type: Sequelize.INTEGER,
      references: {
        model: ProductionEntries,
        key: 'id',
      },
      onDelete: 'RESTRICT', // Change to ON DELETE RESTRICT
      onUpdate: 'CASCADE',  // Keep ON UPDATE CASCADE
      allowNull: true,
    },
  }, {
    tableName: 'production_entries',
  });

  return ProductionEntry;
};
