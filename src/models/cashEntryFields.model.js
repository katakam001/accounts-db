module.exports = (sequelize, Sequelize, CashSaleEntry, Field) => {
  const CashEntryField = sequelize.define('CashEntryField', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    cash_sale_entry_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: CashSaleEntry,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    field_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Field,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    field_value: {
      type: Sequelize.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'cash_entry_fields'
  });

  return CashEntryField;
};
