const db = require("../models");
const PurchaseCategories = db.purchaseCategories;
const Units = db.units;

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await PurchaseCategories.findAll();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllCategoriesWithUnits = async (req, res) => {
  try {
    const categories = await PurchaseCategories.findAll({
      include: [{
        model: Units,
        as: 'units',
        attributes: ['name']
      }]
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.createCategory = async (req, res) => {
  try {
    console.log(req.body);
    const category = await PurchaseCategories.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await PurchaseCategories.update(req.body, { where: { id } });
    if (updated) {
      const updatedCategory = await PurchaseCategories.findOne({ where: { id } });
      res.status(200).json(updatedCategory);
    } else {
      throw new Error('Category not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id);
    const deleted = await PurchaseCategories.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error('Category not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
