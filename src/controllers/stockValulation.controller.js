const { getDb } = require("../utils/getDb");
const { generateStockValuationData } = require("../services/stockValuation.service");

exports.generateStockValuation = async (req, res) => {
  const user_id = parseInt(req.query.userId, 10);
  const financial_year = req.query.financialYear;
  const start_date = req.query.startDate;
  const end_date = req.query.endDate;

  if (isNaN(user_id)) {
    return res.status(400).json({ error: 'userId must be an integer' });
  }
  if (!financial_year || !start_date || !end_date) {
    return res.status(400).json({ error: 'financialYear, startDate, and endDate are required' });
  }

  try {
    const db = getDb();
    const StockValuation = db.stock_valulation;

    const existingManual = await StockValuation.findOne({
      where: {
        user_id,
        financial_year,
        is_manual: true
      }
    });

    if (existingManual) {
      const valuations = await StockValuation.findAll({
        where: { user_id, financial_year },
        attributes: [
          'id',
          'item_id',
          'start_date',
          'end_date',
          'opening_stock_valuation',
          'closing_stock_valuation',
          'is_manual',
          [db.sequelize.col('item.name'), 'item_name']
        ],
        include: [{ model: db.items, as: 'item', attributes: [] }],
        order: [['item_id', 'ASC']]
      });

      return res.status(200).json(valuations);
    }

    await generateStockValuationData({ db, user_id, financial_year, start_date, end_date });

    const valuations = await StockValuation.findAll({
      where: { user_id, financial_year },
      attributes: [
        'id',
        'item_id',
        'start_date',
        'end_date',
        'opening_stock_valuation',
        'closing_stock_valuation',
        'is_manual',
        [db.sequelize.col('item.name'), 'item_name']
      ],
      include: [{ model: db.items, as: 'item', attributes: [] }],
      order: [['item_id', 'ASC']]
    });

    res.status(200).json(valuations);
  } catch (error) {
    console.error('Error generating stock valuation:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.fetchStockValuation = async (req, res) => {
  const user_id = parseInt(req.query.userId, 10);
  const financial_year = req.query.financialYear;
  const start_date = req.query.startDate;
  const end_date = req.query.endDate;

  if (isNaN(user_id)) {
    return res.status(400).json({ error: 'userId must be an integer' });
  }
  if (!financial_year || !start_date || !end_date) {
    return res.status(400).json({ error: 'financialYear, startDate, and endDate are required' });
  }

  try {
    const db = getDb();
    const StockValuation = db.stock_valulation;

    let valuations = await StockValuation.findAll({
      where: { user_id, financial_year },
      attributes: [
        'id',
        'item_id',
        'start_date',
        'end_date',
        'opening_stock_valuation',
        'closing_stock_valuation',
        'is_manual',
        [db.sequelize.col('item.name'), 'item_name']
      ],
      include: [{ model: db.items, as: 'item', attributes: [] }],
      order: [['item_id', 'ASC']]
    });

    if (valuations.length === 0) {
      await generateStockValuationData({ db, user_id, financial_year, start_date, end_date });

      valuations = await StockValuation.findAll({
        where: { user_id, financial_year },
        attributes: [
          'id',
          'item_id',
          'start_date',
          'end_date',
          'opening_stock_valuation',
          'closing_stock_valuation',
          'is_manual',
          [db.sequelize.col('item.name'), 'item_name']
        ],
        include: [{ model: db.items, as: 'item', attributes: [] }],
        order: [['item_id', 'ASC']]
      });
    }

    res.status(200).json(valuations);
  } catch (error) {
    console.error('Error fetching stock valuation:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateStockValuation = async (req, res) => {
  try {
    const db = getDb();
    const StockValuation = db.stock_valulation;
    const { id } = req.params;

    const [updated] = await StockValuation.update(req.body, { where: { id } });

    if (updated) {
      const updatedValuation = await StockValuation.findOne({
        where: { id },
        attributes: [
          'id',
          'item_id',
          'start_date',
          'end_date',
          'opening_stock_valuation',
          'closing_stock_valuation',
          'is_manual',
          [db.sequelize.col('item.name'), 'item_name']
        ],
        include: [{ model: db.items, as: 'item', attributes: [] }]
      });

      res.status(200).json(updatedValuation);
    } else {
      throw new Error("Stock Valuation not found");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
