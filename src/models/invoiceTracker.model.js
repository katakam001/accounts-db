module.exports = (sequelize, Sequelize) => {
  const InvoiceTracker = sequelize.define("InvoiceTracker", {
    user_id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
    },
    financial_year: {
      type: Sequelize.STRING(10),
      allowNull: false,
    },
    type: {
      type: Sequelize.INTEGER,
      allowNull: false,
      comment: "Integer (1 to 6, max 10 in future)",
    },
    last_sno: {
      type: Sequelize.INTEGER,
      allowNull: false,
    }
  }, {
    tableName: 'invoice_tracker',
  });

  return InvoiceTracker;
};
