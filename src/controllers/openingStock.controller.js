const { getDb } = require("../utils/getDb");

exports.getAllOpeningStock = async (req, res) => {
  try {
    const db = getDb();
    const OpeningStock = db.opening_stock;
    const { userId, financialYear } = req.query;

    const whereClause = {
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear })
    };

    const stocks = await OpeningStock.findAll({
      where: whereClause,
      attributes: [
        'id',
        'item_id',
        'quantity',
        'rate',
        'value',
        [db.sequelize.col('item.name'), 'item_name']
      ],
      include: [
        { model: db.items, as: 'item' },
      ]
    });

    res.json(stocks);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

exports.createOpeningStock = async (req, res) => {
  try {
    const db = getDb();
    const OpeningStock = db.opening_stock;
    const stock = await OpeningStock.create(req.body);
    const newStock = await OpeningStock.findOne({
      where: { id: stock.id },
      attributes: [
        'id',
        'item_id',
        'quantity',
        'rate',
        'value',
        [db.sequelize.col('item.name'), 'item_name']
      ],
      include: [
        { model: db.items, as: 'item' },
      ]
    });
    res.status(201).json(newStock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOpeningStock = async (req, res) => {
  try {
    const db = getDb();
    const OpeningStock = db.opening_stock;
    const { id } = req.params;
    const [updated] = await OpeningStock.update(req.body, { where: { id } });
    if (updated) {
      const updatedStock = await OpeningStock.findOne({
        where: { id: id },
        attributes: [
          'id',
          'item_id',
          'quantity',
          'rate',
          'value',
          [db.sequelize.col('item.name'), 'item_name']
        ],
        include: [
          { model: db.items, as: 'item' },
        ]
      });
      res.status(200).json(updatedStock);
    } else {
      throw new Error("Opening Stock not found");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteOpeningStock = async (req, res) => {
  try {
    const db = getDb();
    const OpeningStock = db.opening_stock;
    const { id } = req.params;
    const deleted = await OpeningStock.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error("Opening Stock not found");
    }
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({
        error: 'foreign key constraint',
        message: `Cannot delete item due to foreign key constraint.`,
        detail: error.parent.detail || error.message, // Provide only relevant database details
      });
    } else {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
};
