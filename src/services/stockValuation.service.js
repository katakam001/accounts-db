exports.generateStockValuationData = async ({ db, user_id, financial_year, start_date, end_date }) => {
  const sequelize = db.sequelize;
  const StockValuation = db.stock_valulation;
  // 🔍 Check for existing manual valuation
  const existingManual = await StockValuation.findOne({
    where: {
      user_id,
      financial_year,
      is_manual: true
    }
  });

  if (existingManual) {
    // ✅ Skip generation if manual entry exists
    console.log('Manual stock valuation exists — skipping stored procedure.');
    return;
  }

  // 🧹 Delete existing auto-generated valuations
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
