const { getDb } = require("../utils/getDb");

exports.getAllItems = async (req, res) => {
  try {
    const db = getDb();
    const Item = db.items;
    const items = await Item.findAll();
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
    console.log(req.body);
    const item = await Item.create(req.body);
    res.status(201).json(item);
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
      const updatedItem = await Item.findOne({ where: { id } });
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
