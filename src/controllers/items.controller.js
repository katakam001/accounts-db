const { getDb } = require("../utils/getDb");
const { getAllItems } = require('../services/items.service');

exports.getAllItems = async (req, res) => {
  try {
    const { userId, financialYear } = req.query;

    const items = await getAllItems({  userId, financialYear });   

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
  const { id } = req.params;
  try {
    const db = getDb();
    const Items = db.items;

    // Check if the item exists
    const item = await Items.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Attempt to delete the item
    await item.destroy();

    // Successful deletion
    res.status(200).json({ message: 'Item deleted successfully' });
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
