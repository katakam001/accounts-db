module.exports = (sequelize, Sequelize,Account,Group) => {
    const CashEntriesBatch = sequelize.define('CashEntriesBatch', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
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
        onUpdate: 'CASCADE', // Optional: Retains ON UPDATE CASCADE for consistency
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
        allowNull: true,
      },
      financial_year: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      transaction_id: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
    }, {
      tableName: 'cash_entries_batch',
    });
  
    return CashEntriesBatch;
  };
  