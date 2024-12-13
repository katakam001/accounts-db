module.exports = (sequelize, Sequelize, Account) => {
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
    type: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
    },
    amount: {
      type: Sequelize.FLOAT,
      allowNull: false,
    },
    user_id: {
      type: Sequelize.INTEGER,
    },
    financial_year: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  }, {
      tableName: 'cash_entries',
  });
  return CashEntry;
};
