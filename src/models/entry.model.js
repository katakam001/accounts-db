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
      onDelete: 'CASCADE'
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
      onDelete: 'SET NULL'
    },
    item_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Items,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
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
    value: {
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
    unit_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Units,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    journal_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: JournalEntry,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    type: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'entries',
  });

  return Entry;
};
