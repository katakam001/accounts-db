module.exports = (sequelize, Sequelize, Account, Group) => {
  const CashEntry = sequelize.define('cashEntry', {
    cash_date: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    narration: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    account_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Account,
        key: 'id'
      }
    },
    group_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Group,
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    type: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
    },
    amount: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    },
    user_id: {
      type: Sequelize.INTEGER,
    },
    financial_year: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    transaction_id: {
      type: Sequelize.STRING(30),
      allowNull: true,
    },
    is_cash_adjustment: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'cash_entries',
  });
  return CashEntry;
};
