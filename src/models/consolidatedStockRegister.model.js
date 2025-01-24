module.exports = (sequelize, Sequelize) => {
    const ConsolidatedStockRegister = sequelize.define("ConsolidatedStockRegister", {
      item_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
      },
      total_purchase: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_sales: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_sale_return: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_purchase_return: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_quantity: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_closing_balance: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_dispatch_to_process: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      total_received_from_process: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
      },
      financial_year: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
    }, {
      tableName: 'consolidated_stock_register',
    });
  
    return ConsolidatedStockRegister;
  };
  