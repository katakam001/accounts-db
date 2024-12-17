module.exports = (sequelize, Sequelize, PurchaseCategory, Account) => {
  const PurchaseEntry = sequelize.define('PurchaseEntry', {
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
    purchase_date: {
      type: Sequelize.DATE,
      allowNull: false
    },
    account_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: Account,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    item_description: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    quantity: {
      type: Sequelize.NUMERIC,
      allowNull: true
    },
    unit_price: {
      type: Sequelize.NUMERIC,
      allowNull: true
    },
    total_amount: {
      type: Sequelize.NUMERIC,
      allowNull: true
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: true
    },
    financial_year: {
      type: Sequelize.STRING,
      allowNull: false
    }
  }, {
    tableName: 'purchase_entries',
  });

  return PurchaseEntry;
};
