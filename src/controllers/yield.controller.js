const { getDb } = require("../utils/getDb");

exports.getAllYields = async (req, res) => {
  try {
    const db = getDb();
    const RawItem = db.raw_items;
    const ProcessedItem = db.processed_items;

    const rawItems = await RawItem.findAll({ include: [{ model: db.items, as: 'item' }, { model: db.units, as: 'unit' }] });

    const yieldList = await Promise.all(rawItems.map(async (rawItem) => {
      const processedItems = await ProcessedItem.findAll({ where: { raw_item_id: rawItem.id }, include: [{ model: db.items, as: 'item' }, { model: db.units, as: 'unit' }] });

      return {
        rawItem: {
          id: rawItem.id,
          item_id: rawItem.item_id,
          unit_id: rawItem.unit_id,
          user_id: rawItem.user_id,
          financial_year: rawItem.financial_year,
          createdAt: rawItem.createdAt,
          updatedAt: rawItem.updatedAt,
          item_id: rawItem.item.id,
          item_name: rawItem.item.name,
          unit_id: rawItem.unit.id,
          unit_name: rawItem.unit.name
        },
        processedItems: processedItems.map(item => ({
          id: item.id,
          raw_item_id: item.raw_item_id,
          item_id: item.item_id,
          unit_id: item.unit_id,
          percentage: item.percentage,
          conversion_id:item.conversion_id,
          user_id: item.user_id,
          financial_year: item.financial_year,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          item_id: item.item.id,
          item_name: item.item.name,
          unit_id: item.unit.id,
          unit_name: item.unit.name
        }))
      };
    }));

    res.json(yieldList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};



exports.createYield = async (req, res) => {
  try {
    const db = getDb();
    const RawItem = db.raw_items;
    const ProcessedItem = db.processed_items;

    const { rawItem, processedItems } = req.body;

    // Create Raw Item
    const newRawItem = await RawItem.create({
      item_id: rawItem.item_id,
      unit_id: rawItem.unit_id,
      user_id: rawItem.user_id,
      financial_year: rawItem.financial_year,
    });

    // Create Processed Items
    for (const processedItem of processedItems) {
      await ProcessedItem.create({
        raw_item_id: newRawItem.id,
        item_id: processedItem.item_id,
        unit_id: processedItem.unit_id,
        percentage: processedItem.percentage,
        user_id: newRawItem.user_id,
        financial_year: newRawItem.financial_year,
        conversion_id:processedItem.conversion_id
      });
    }

    res.status(201).json({ message: 'Yield data created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.updateYield = async (req, res) => {
  try {
    const db = getDb();
    const RawItem = db.raw_items;
    const ProcessedItem = db.processed_items;

    const { id } = req.params;
    const { rawItem, processedItems } = req.body;

    // Update Raw Item
    const rawItemToUpdate = await RawItem.findByPk(id);
    if (rawItemToUpdate) {
      await rawItemToUpdate.update({
        item_id: rawItem.item_id,
        unit_id: rawItem.unit_id,
        user_id: rawItem.user_id,
        financial_year: rawItem.financial_year,
      });
    }

    // Delete existing Processed Items and By-products
    await ProcessedItem.destroy({ where: { raw_item_id: id } });

    // Create new Processed Items
    for (const processedItem of processedItems) {
      await ProcessedItem.create({
        raw_item_id: id,
        item_id: processedItem.item_id,
        unit_id: processedItem.unit_id,
        percentage: processedItem.percentage,
        user_id: rawItem.user_id,
        financial_year: rawItem.financial_year,
        conversion_id:processedItem.conversion_id
      });
    }

    res.status(200).json({ message: 'Yield data updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteYield = async (req, res) => {
  try {
    const db = getDb();
    const RawItem = db.raw_items;
    const ProcessedItem = db.processed_items;

    const { id } = req.params;

    // Delete Processed Items
    await ProcessedItem.destroy({ where: { raw_item_id: id } });

    // Delete Raw Item
    await RawItem.destroy({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
