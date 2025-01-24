const { getDb } = require("../utils/getDb");
const { broadcast } = require('../websocket'); // Import the broadcast function

exports.getAllProductionEntries = async (req, res) => {
  try {
    const db = getDb();
    const ProductionEntry = db.production_entries;
    const productionEntries = await ProductionEntry.findAll({
      include: [
        { model: db.items, as: 'rawItem' },
        { model: db.items, as: 'processedItem' },
        { model: db.units, as: 'unit' },
        { model: db.conversions, as: 'conversion' }
      ]
    });

    // Filter out the main production entries
    const mainProductionEntries = productionEntries.filter(entry => !entry.production_entry_id);

    const formattedProductionEntries = mainProductionEntries.map(entry => ({
      id: entry.id,
      raw_item_id: entry.raw_item_id,
      raw_item_name: entry.rawItem.name,
      production_date: entry.production_date,
      quantity: entry.quantity,
      unit_id: entry.unit_id,
      unit_name: entry.unit.name,
      percentage: entry.percentage,
      user_id: entry.user_id,
      financial_year: entry.financial_year,
      conversion_id: entry.conversion_id,
      conversion_rate: entry.conversion ? entry.conversion.rate : null,
      processedItems: productionEntries.filter(item => item.production_entry_id === entry.id).map(item => ({
        item_id: item.item_id,
        item_name: item.processedItem.name,
        quantity: item.quantity,
        unit_id: item.unit_id,
        unit_name: item.unit.name,
        percentage: item.percentage,
        conversion_id: item.conversion_id
      }))
    }));

    res.json(formattedProductionEntries);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

exports.createProductionEntry = async (req, res) => {
  try {
    const db = getDb();
    const t = await db.sequelize.transaction();
    const ProductionEntry = db.production_entries;
    const { processedItems, ...productionEntryData } = req.body;

    const productionEntry = await ProductionEntry.create(productionEntryData, { transaction: t });

    // Insert each processed item as a separate entry in the production_entries table
    for (const item of processedItems) {
      await ProductionEntry.create({
        raw_item_id: productionEntry.raw_item_id,
        production_date: productionEntry.production_date,
        quantity: item.quantity,
        unit_id: item.unit_id,
        item_id: item.item_id,
        percentage: item.percentage,
        user_id: productionEntry.user_id,
        financial_year: productionEntry.financial_year,
        conversion_id: item.conversion_id,
        production_entry_id: productionEntry.id // Link to the main production entry
      }, { transaction: t });
    }

    // Fetch the associated items, unit, and conversion
    const rawItem = await db.items.findByPk(productionEntry.raw_item_id, { transaction: t });
    const unit = await db.units.findByPk(productionEntry.unit_id, { transaction: t });
    const conversion = await db.conversions.findByPk(productionEntry.conversion_id, { transaction: t });

    const formattedProductionEntry = {
      id: productionEntry.id,
      raw_item_id: productionEntry.raw_item_id,
      raw_item_name: rawItem.name,
      production_date: productionEntry.production_date,
      quantity: productionEntry.quantity,
      unit_id: productionEntry.unit_id,
      unit_name: unit.name,
      percentage: productionEntry.percentage,
      user_id: productionEntry.user_id,
      financial_year: productionEntry.financial_year,
      conversion_id: productionEntry.conversion_id,
      conversion_rate: conversion ? conversion.rate : null,
      processedItems: processedItems.map(item => ({
        item_id: item.item_id,
        quantity: item.quantity,
        unit_id: item.unit_id,
        percentage: item.percentage,
        conversion_id: item.conversion_id
      }))
    };

    // Commit the transaction
    await t.commit();

    // Broadcast the new production entry
    broadcast({ type: 'INSERT', data: formattedProductionEntry, entryType: 'productionEntry', user_id: productionEntry.user_id, financial_year: productionEntry.financial_year });

    res.status(201).json({ message: 'Production entry created successfully' }); // Simplified response
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: 'Internal server error' });
  }
};



exports.updateProductionEntry = async (req, res) => {
  try {
    const db = getDb();
    const t = await db.sequelize.transaction();
    const ProductionEntry = db.production_entries;
    const { id } = req.params;
    const { processedItems, ...productionEntryData } = req.body;

    const [updated] = await ProductionEntry.update(productionEntryData, { where: { id }, transaction: t });
    if (updated) {
      await ProductionEntry.destroy({ where: { production_entry_id: id }, transaction: t });
      for (const item of processedItems) {
        await ProductionEntry.create({
          raw_item_id: productionEntryData.raw_item_id,
          production_date: productionEntryData.production_date,
          quantity: item.quantity,
          unit_id: item.unit_id,
          item_id: item.item_id,
          percentage: item.percentage,
          user_id: productionEntryData.user_id,
          financial_year: productionEntryData.financial_year,
          conversion_id: item.conversion_id,
          production_entry_id: id
        }, { transaction: t });
      }

      const updatedProductionEntry = await ProductionEntry.findOne({
        where: { id },
        include: [
          { model: db.items, as: 'rawItem' },
          { model: db.items, as: 'processedItem' },
          { model: db.units, as: 'unit' },
          { model: db.conversions, as: 'conversion' }
        ],
        transaction: t
      });

      const formattedProductionEntry = {
        id: updatedProductionEntry.id,
        raw_item_id: updatedProductionEntry.raw_item_id,
        raw_item_name: updatedProductionEntry.rawItem.name,
        production_date: updatedProductionEntry.production_date,
        quantity: updatedProductionEntry.quantity,
        unit_id: updatedProductionEntry.unit_id,
        unit_name: updatedProductionEntry.unit.name,
        percentage: updatedProductionEntry.percentage,
        user_id: updatedProductionEntry.user_id,
        financial_year: updatedProductionEntry.financial_year,
        conversion_id: updatedProductionEntry.conversion_id,
        conversion_rate: updatedProductionEntry.conversion ? updatedProductionEntry.conversion.rate : null,
        processedItems: processedItems.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          unit_id: item.unit_id,
          percentage: item.percentage,
          conversion_id: item.conversion_id
        }))
      };

      // Commit the transaction
      await t.commit();

      // Broadcast the updated production entry
      broadcast({ type: 'UPDATE', data: formattedProductionEntry, entryType: 'productionEntry', user_id: updatedProductionEntry.user_id, financial_year: updatedProductionEntry.financial_year });

      res.status(200).json({ message: 'Production entry updated successfully' }); // Simplified response
    } else {
      throw new Error('Production entry not found');
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteProductionEntry = async (req, res) => {
  try {
    const db = getDb();
    const transaction = await db.sequelize.transaction();
    const ProductionEntry = db.production_entries;
    const { id } = req.params;

    // Fetch the entry to get user_id and financial_year using production_entry_id
    const entry = await ProductionEntry.findOne({ where: { production_entry_id: id } });
    if (!entry) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Production entry not found' });
    }
    const { user_id, financial_year } = entry;

    // First, delete the processed items
    await ProductionEntry.destroy({ where: { production_entry_id: id } }, { transaction });

    // Then, delete the main production entry
    const deleted = await ProductionEntry.destroy({ where: { id } }, { transaction });

    if (deleted) {
      // Commit the transaction
      await transaction.commit();

      // Broadcast the deletion event
      broadcast({ type: 'DELETE', data: { id }, entryType: 'productionEntry', user_id, financial_year });

      res.status(204).send(); // Simplified response
    } else {
      await transaction.rollback();
      throw new Error('Production entry not found');
    }
  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    console.error('Error deleting production entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



