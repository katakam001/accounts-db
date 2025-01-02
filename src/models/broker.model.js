module.exports = (sequelize, Sequelize) => {
  const Broker = sequelize.define("Broker", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    contact: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: null, // Allow null values
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    financial_year: {
      type: Sequelize.STRING(10),
      allowNull: true,
    }
  }, {
    tableName: 'brokers',
  });

  return Broker;
};
