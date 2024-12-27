const db = require("../models");
const Categories = db.categories;
const Units = db.units;

exports.getAllCategories = async (req, res) => {
  try {
    const { type } = req.query;
    const whereClause = type ? { where: { type } } : {};
    const categories = await Categories.findAll(whereClause);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.getAllCategoriesWithUnits = async (req, res) => {
  try {
    const categories = await Categories.findAll({
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
    const category = await Categories.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await Categories.update(req.body, { where: { id } });
    if (updated) {
      const updatedCategory = await Categories.findOne({ where: { id } });
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
    const deleted = await Categories.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error('Category not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
