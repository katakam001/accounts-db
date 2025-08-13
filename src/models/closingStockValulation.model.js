module.exports = (sequelize, Sequelize, Items) => {
  const ClosingStockValuation = sequelize.define("closing_stock_valuation", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
      primaryKey: true
    },
    item_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: Items,
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    financial_year: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    start_date: {
      type: Sequelize.DATE,
      allowNull: false
    },
    end_date: {
      type: Sequelize.DATE,
      allowNull: false
    },
    value: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true
    },
    is_manual: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'closing_stock_valuation'
  });

  return ClosingStockValuation;
};
