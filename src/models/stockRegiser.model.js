module.exports = (sequelize, Sequelize,Items) => {
  const StockRegister = sequelize.define('stock_register', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    item_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Items,
        key: 'id',
      },
    },
    entry_date: {
      type: Sequelize.DATEONLY,
      allowNull: false,
    },
    opening_balance: {
      type: Sequelize.NUMERIC(10, 4),
      allowNull: false,
    },
    quantity: {
      type: Sequelize.NUMERIC(10, 4),
      allowNull: false,
    },
    closing_balance: {
      type: Sequelize.NUMERIC(10, 4),
      allowNull: false,
    },
    entry_type: {
      type: Sequelize.STRING(20),
      allowNull: false,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    financial_year: {
      type: Sequelize.STRING(10),
      allowNull: false,
    },
    dispatch_to_process: {
      type: Sequelize.NUMERIC(10, 4),
      allowNull: false,
      defaultValue: 0,
    },
    received_from_process: {
      type: Sequelize.NUMERIC(10, 4),
      allowNull: false,
      defaultValue: 0,
    },
    purchase: {
      type: Sequelize.NUMERIC(10, 4),
      allowNull: false,
      defaultValue: 0,
    },
    sales: {
      type: Sequelize.NUMERIC(10, 4),
      allowNull: false,
      defaultValue: 0,
    },
    sale_return: {
      type: Sequelize.NUMERIC(10, 4),
      allowNull: false,
      defaultValue: 0,
    },
    purchase_return: {
      type: Sequelize.NUMERIC(10, 4),
      allowNull: false,
      defaultValue: 0,
    },
    value: {
      type: Sequelize.NUMERIC(15, 2),
      allowNull: true,
        }
    }, {
        tableName: 'stock_register'
    });

    return StockRegister;
};