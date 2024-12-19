module.exports = (sequelize, Sequelize, PurchaseCategory, Account, Units,JournalEntry) => {
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
    purchase_value: { // New field for purchase_value
      type: Sequelize.DECIMAL(20, 2),
      allowNull: true
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: true
    },
    financial_year: {
      type: Sequelize.STRING,
      allowNull: false
    },
    unit_id: { // New field for unit_id
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Units, // Reference to the units table
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    journal_id: { // New field for journal_id
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: JournalEntry, // Reference to the journal entries table
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    }
  }, {
    tableName: 'purchase_entries',
  });

  return PurchaseEntry;
};
