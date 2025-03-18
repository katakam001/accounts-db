module.exports = (sequelize, Sequelize) => {
    const Balance = sequelize.define("Balance", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      financial_year: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      }
    }, {
      tableName: 'balance',
    });
  
    return Balance;
  };
  