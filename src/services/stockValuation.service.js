exports.generateStockValuationData= async ({ db, user_id, financial_year, start_date, end_date }) => { 
  const sequelize = db.sequelize;
  const StockValuation = db.stock_valulation;

  // 🧹 Delete existing valuations
  await StockValuation.destroy({
    where: { user_id, financial_year }
  });

  // 🧮 Call the stored procedure using Sequelize
  await sequelize.query(
    'CALL generate_stock_valuation_for_all_items(:user_id, :financial_year, :start_date, :end_date)',
    {
      replacements: { user_id, financial_year, start_date, end_date }
    }
  );
};
