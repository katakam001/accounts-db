module.exports = (sequelize, Sequelize, Account) => {
  const DailyCashEntrySummary = sequelize.define('DailyCashEntrySummary', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    entry_date: {
      type: Sequelize.DATEONLY,
      allowNull: false
    },
    account_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Account,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    total_amount: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    financial_year: {
      type: Sequelize.TEXT,
      allowNull: false
    },
  }, {
    tableName: 'daily_cash_entry_summary'
  });

  return DailyCashEntrySummary;
};
