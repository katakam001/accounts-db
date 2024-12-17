module.exports = (sequelize, Sequelize,PurchaseEntry) => {
  const PurchaseEntryField = sequelize.define('PurchaseEntryField', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER
    },
    entry_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: PurchaseEntry,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    field_name: {
      type: Sequelize.STRING,
      allowNull: false
    },
    field_value: {
      type: Sequelize.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'purchase_entry_fields',
  });
  return PurchaseEntryField;
};
