const { getDb } = require("../utils/getDb");

exports.getAllItems = async (req, res) => {
  try {
    const db = getDb();
    const Item = db.items;
    const { userId, financialYear } = req.query;

    const whereCondition = {
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear })
    };

    const items = await Item.findAll({
      attributes: ['id', 'name', 'user_id', 'financial_year'],
      where: whereCondition
    });

    res.json(items);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

exports.createItem = async (req, res) => {
  try {
    const db = getDb();
    const Item = db.items;
    const item = await Item.create(req.body);

    const createdItem = {
      id: item.id,
      name: item.name,
      user_id: item.user_id,
      financial_year: item.financial_year
    };

    res.status(201).json(createdItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const db = getDb();
    const Item = db.items;
    const { id } = req.params;
    const [updated] = await Item.update(req.body, { where: { id } });
    if (updated) {
      const updatedItem = await Item.findOne({
        where: { id },
        attributes: ['id', 'name', 'user_id', 'financial_year']
      });
      res.status(200).json(updatedItem);
    } else {
      throw new Error('Item not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.deleteItem = async (req, res) => {
  try {
    const db = getDb();
    const Item = db.items;
    const { id } = req.params;
    const deleted = await Item.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error('Item not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
