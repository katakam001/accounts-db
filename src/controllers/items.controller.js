const { getDb } = require("../utils/getDb");
const { getAllItems } = require('../services/items.service');
const cache = require("../services/cache.service"); // ✅ Import shared cache service
const invoiceUtils = require('../utils/invoiceUtils');

exports.getAllItems = async (req, res) => {
  try {
    const { userId, financialYear } = req.query;

    const items = await getAllItems({ userId, financialYear });

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

    // Normalize name for consistency
    if (req.body.name) {
      req.body.name = req.body.name.trim();
    }

    const item = await Item.create(req.body);

    const createdItem = {
      id: item.id,
      name: item.name,
      user_id: item.user_id,
      financial_year: item.financial_year
    };

    // 🔁 Cache update
    const cacheKey = `${createdItem.user_id}_${createdItem.financial_year}`;
    const cachedData = cache.getCache(cacheKey);

    if (Array.isArray(cachedData?.items) && cachedData?.itemsMap instanceof Map) {
      cachedData.items.push(createdItem);

      const newMap = invoiceUtils.categorizeItemsByTaxRate([createdItem]);
      for (const [key, value] of newMap.entries()) {
        cachedData.itemsMap.set(key, value);
      }

      cache.setCache(cacheKey, cachedData, 3600);
    }

    res.status(201).json(createdItem);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const itemName = req.body.name;
      res.status(400).json({
        error: 'Duplicate item name',
        message: `The item '${itemName}' already exists. Please choose a different name.`
      });
    } else {
      console.error('Error creating item:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while creating the item.'
      });
    }
  }
};

exports.updateItem = async (req, res) => {
  try {
    const db = getDb();
    const Item = db.items;
    const { id } = req.params;

    // Normalize name if present
    if (req.body.name) {
      req.body.name = req.body.name.trim();
    }

    // Fetch existing item before update
    const existingItem = await Item.findOne({
      where: { id },
      attributes: ['id', 'name', 'user_id', 'financial_year']
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Not Found', message: 'Item not found' });
    }

    // Perform update
    const [updated] = await Item.update(req.body, { where: { id } });
    if (!updated) throw new Error('Item update failed');

    const updatedItem = await Item.findOne({
      where: { id },
      attributes: ['id', 'name', 'user_id', 'financial_year'],
            raw: true
    });

    // 🔁 Cache update
    const cacheKey = `${updatedItem.user_id}_${updatedItem.financial_year}`;
    const cachedData = cache.getCache(cacheKey);

    if (Array.isArray(cachedData?.items) && cachedData?.itemsMap instanceof Map) {
      // ✅ Remove old composite key
      const oldMap = invoiceUtils.categorizeItemsByTaxRate([existingItem.dataValues]);
      for (const key of oldMap.keys()) {
        cachedData.itemsMap.delete(key);
      }

      // ✅ Replace item in list
      const index = cachedData.items.findIndex(i => i.id === updatedItem.id);
      if (index !== -1) {
        cachedData.items[index] = updatedItem;
      }

      // ✅ Add new composite key
      const newMap = invoiceUtils.categorizeItemsByTaxRate([updatedItem]);
      for (const [key, value] of newMap.entries()) {
        cachedData.itemsMap.set(key, value);
      }

      cache.setCache(cacheKey, cachedData, 3600);
    }

    res.status(200).json(updatedItem);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const itemName = req.body.name;
      res.status(400).json({
        error: 'Duplicate item name',
        message: `The item '${itemName}' already exists. Please choose a different name.`
      });
    } else {
      console.error('Error updating item:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while updating the item.'
      });
    }
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
    const { user_id, financial_year } = item;

    // Attempt to delete the item
    await item.destroy();

    // 🔁 Cache cleanup
    const cacheKey = `${user_id}_${financial_year}`;
    const cachedData = cache.getCache(cacheKey);

    if (Array.isArray(cachedData?.items) && cachedData?.itemsMap instanceof Map) {
      // ✅ Remove from item list
      cachedData.items = cachedData.items.filter(i => i.id !== item.id);

      // ✅ Remove from item map
      const oldMap = invoiceUtils.categorizeItemsByTaxRate([item.dataValues]);
      for (const key of oldMap.keys()) {
        cachedData.itemsMap.delete(key);
      }

      cache.setCache(cacheKey, cachedData, 3600);
    }

    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error.message);

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({
        error: 'foreign key constraint',
        message: 'Cannot delete item due to foreign key constraint.',
        detail: error.parent.detail || error.message
      });
    } else {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
};
