module.exports = (sequelize, Sequelize, Category, Account, Units, Items) => {
  const CashSaleEntry = sequelize.define('CashSaleEntry', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
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
    entry_date: {
      type: Sequelize.DATE,
      allowNull: false
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
    type: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 8
    },
    invoiceNumber: {
      type: Sequelize.STRING,
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
    invoice_seq_id: {
      type: Sequelize.BIGINT,
      allowNull: true
    },
    sNo: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    }
  }, {
    tableName: 'cash_sale_entries'
  });

  return CashSaleEntry;
};
