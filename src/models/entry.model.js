module.exports = (sequelize, Sequelize, Category, Account, Units, JournalEntry, Items) => {
  const Entry = sequelize.define('Entry', {
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
        model: Category,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    entry_date: {
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
      onDelete: 'RESTRICT'
    },
    item_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Items,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    quantity: {
      type: Sequelize.DECIMAL(10, 4),
      allowNull: true
    },
    unit_price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    },
    total_amount: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true
    },
    value: {
      type: Sequelize.DECIMAL(15, 2),
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
    unit_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Units,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    journal_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: JournalEntry,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    type: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    invoiceNumber: {
      type: Sequelize.STRING,
      allowNull: false
    },
    invoice_seq_id: {
      type: Sequelize.BIGINT, // Adding the invoice_seq_id field
      allowNull: true
    },
    category_account_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: Account,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
  }, {
    tableName: 'entries',
  });

  return Entry;
};
