const {getDb} = require("../utils/getDb");
const { fetchCategories } = require('../services/category.service');

exports.getAllCategories = async (req, res) => {
  try {
    const { type, userId, financialYear } = req.query;
    const categories = await fetchCategories({ type, userId, financialYear });   
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.getAllCategoriesWithUnits = async (req, res) => {
  try {
    const db = getDb();
    const Categories = db.categories;
    const Units = db.units;
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
    const db = getDb();
    const Categories = db.categories;
    console.log(req.body);
    const category = await Categories.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const db = getDb();
    const Categories = db.categories;
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
  const { id } = req.params;
  try {
    const db = getDb();
    const Categories = db.categories;

    // Check if the category exists
    const category = await Categories.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Attempt to delete the category
    await category.destroy();

    // Successful deletion
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({
        error: 'foreign key constraint',
        message: `Cannot delete category due to foreign key constraint.`,
        detail: error.parent.detail || error.message, // Provide only relevant database details
      });
    } else {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
};
