module.exports = (sequelize, Sequelize, CashSaleEntry, DailyCashEntrySummary) => {
  const CashSaleEntryLink = sequelize.define('CashSaleEntryLink', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    cash_sale_entry_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: CashSaleEntry,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    summary_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: DailyCashEntrySummary,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    }
  }, {
    tableName: 'cash_sale_entry_links'
  });

  return CashSaleEntryLink;
};
