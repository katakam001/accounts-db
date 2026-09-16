const { getDb } = require("../utils/getDb");
const { fetchCategories } = require('../services/category.service');
const cache = require("../services/cache.service"); // ✅ Import shared cache service
const invoiceUtils = require('../utils/invoiceUtils');

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
    if (req.body.name) {
      req.body.name = req.body.name.trim();
    }
    const category = await Categories.create(req.body);
    const rawCategory = category.get({ plain: true });
    delete rawCategory.createdAt;
    delete rawCategory.updatedAt;

    const { type, user_id, financial_year } = rawCategory;

    const selectedPrefix = type === 1 ? "purchase" : "sale";

    const cacheKey = `${user_id}_${financial_year}`;
    const cachedData = cache.getCache(cacheKey);

    if (cachedData?.[`${selectedPrefix}Categories`] && cachedData?.[`${selectedPrefix}CategoryMap`] instanceof Map) {
      // ✅ Append to category list

      cachedData[`${selectedPrefix}Categories`].push(rawCategory);

      // ✅ Generate composite key and insert into map
      const newMap = invoiceUtils.categorizeCategoriesByTaxRate([rawCategory]);
      for (const [key, value] of newMap.entries()) {
        cachedData[`${selectedPrefix}CategoryMap`].set(key, value);
      }

      cache.setCache(cacheKey, cachedData, 3600); // Refresh TTL
    }

    res.status(201).json(rawCategory);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const category_name = req.body.name;
      // Send error response with meaningful message
      res.status(400).json({
        error: 'Duplicate category name detected',
        message: `The category '${category_name}' already exists. Please choose a different category name.`
      });

    } else {
      // Handle other errors
      console.error('Error inserting category name:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing your request.'
      });
    }
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const db = getDb();
    const Categories = db.categories;
    const { id } = req.params;
    // Normalize name if present
    if (req.body.name) {
      req.body.name = req.body.name.trim();
    }

    // Fetch existing category before update
    const rawExistingCategory = await Categories.findOne({
      where: { id },
      raw: true
    });
    if (!rawExistingCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Perform update
    const [updated] = await Categories.update(req.body, { where: { id } });
    if (!updated) throw new Error('Category update failed');

    const updatedCategory = await Categories.findOne({
      attributes: ['id', 'name', 'type', 'user_id', 'financial_year'],
      where: { id },
      raw: true
    });

    // 🔁 Cache update
    const { user_id, financial_year } = updatedCategory;
    const cacheKey = `${user_id}_${financial_year}`;
    const cachedData = cache.getCache(cacheKey);

    const oldPrefix = rawExistingCategory.type === 1 ? "purchase" : "sale";
    const newPrefix = updatedCategory.type === 1 ? "purchase" : "sale";

    const oldCategoryListKey = `${oldPrefix}Categories`;
    const oldCategoryMapKey = `${oldPrefix}CategoryMap`;
    const newCategoryListKey = `${newPrefix}Categories`;
    const newCategoryMapKey = `${newPrefix}CategoryMap`;

    // ✅ Remove from old cache
    if (Array.isArray(cachedData?.[oldCategoryListKey])) {
      cachedData[oldCategoryListKey] = cachedData[oldCategoryListKey].filter(c => c.id !== updatedCategory.id);
    }
    if (cachedData?.[oldCategoryMapKey] instanceof Map) {
      const oldMap = invoiceUtils.categorizeCategoriesByTaxRate([rawExistingCategory]);
      for (const key of oldMap.keys()) {
        cachedData[oldCategoryMapKey].delete(key);
      }
    }

    // ✅ Add to new cache
    if (Array.isArray(cachedData?.[newCategoryListKey]) && cachedData?.[newCategoryMapKey] instanceof Map) {
      cachedData[newCategoryListKey].push(updatedCategory);

      const newMap = invoiceUtils.categorizeCategoriesByTaxRate([updatedCategory]);
      for (const [key, value] of newMap.entries()) {
        cachedData[newCategoryMapKey].set(key, value);
      }
    }

    cache.setCache(cacheKey, cachedData, 3600);

    res.status(200).json(updatedCategory);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const category_name = req.body.name;
      res.status(400).json({
        error: 'Duplicate category name detected',
        message: `The category name "${category_name}" already exists. Please choose a unique name.`
      });
    } else {
      console.error('Error while updating the account:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing your request.'
      });
    }
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

    const { user_id, financial_year, type } = category;
    const selectedPrefix = type === 1 ? "purchase" : "sale";

    // Attempt to delete the category
    await category.destroy();

    // 🔁 Cache cleanup
    const cacheKey = `${user_id}_${financial_year}`;
    const cachedData = cache.getCache(cacheKey);

    const categoryListKey = `${selectedPrefix}Categories`;
    const categoryMapKey = `${selectedPrefix}CategoryMap`;

    if (Array.isArray(cachedData?.[categoryListKey])) {
      cachedData[categoryListKey] = cachedData[categoryListKey].filter(c => c.id !== category.id);
    }

    if (cachedData?.[categoryMapKey] instanceof Map) {
      const oldMap = invoiceUtils.categorizeCategoriesByTaxRate([category.dataValues]);
      for (const key of oldMap.keys()) {
        cachedData[categoryMapKey].delete(key);
      }
    }

    cache.setCache(cacheKey, cachedData, 3600);

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error.message);

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({
        error: 'foreign key constraint',
        message: 'Cannot delete category due to foreign key constraint.',
        detail: error.parent.detail || error.message
      });
    } else {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
};
