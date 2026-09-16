const { getDb } = require("../utils/getDb");
const cache = require("../services/cache.service"); // ✅ Import shared cache service

exports.getCategoryUnitsByCategoryId = async (req, res) => {
  try {
    const db = getDb();
    const Units = db.units;
    const Categories = db.categories;
    const CategoryUnits = db.categoryUnits;
    const { category_id, userId, financialYear } = req.query;

    const whereCondition = {
      ...(category_id && { category_id }),
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear })
    };

    const categoryUnits = await CategoryUnits.findAll({
      where: whereCondition,
      attributes: [
        'id',
        'category_id',
        'unit_id',
        [db.sequelize.col('category.name'), 'category_name'],
        [db.sequelize.col('unit.name'), 'unit_name']
      ],
      include: [
        { model: Categories, as: 'category', attributes: [] },
        { model: Units, as: 'unit', attributes: [] }
      ]
    });
    res.json(categoryUnits);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

exports.createCategoryUnit = async (req, res) => {
  try {
    const db = getDb();
    const CategoryUnits = db.categoryUnits;
    const Categories = db.categories;
    const Units = db.units;

    // Create the new category-unit link
    const categoryUnit = await CategoryUnits.create(req.body);

    // Fetch enriched details for response and cache logic
    const newCategoryUnit = await CategoryUnits.findOne({
      where: { id: categoryUnit.id },
      attributes: [
        'id',
        'category_id',
        'unit_id',
        [db.sequelize.col('category.name'), 'category_name'],
        [db.sequelize.col('unit.name'), 'unit_name'],
        [db.sequelize.col('category.type'), 'category_type']
      ],
      include: [
        { model: Categories, as: 'category', attributes: [] },
        { model: Units, as: 'unit', attributes: [] }
      ]
    });

    // 🔁 Cache update
    const { user_id, financial_year } = categoryUnit;
    const { id, category_id, category_name, unit_id, unit_name, category_type } = newCategoryUnit.dataValues;
    const selectedPrefix = category_type === 1 ? "purchase" : "sale";
    const cacheKey = `${user_id}_${financial_year}`;
    const cachedData = cache.getCache(cacheKey);

    if (cachedData?.[`${selectedPrefix}UnitIdMap`] instanceof Map) {
      const unitEntry = {
        id: unit_id,
        name: unit_name.toLowerCase().trim()
      };
      const existingUnits = cachedData[`${selectedPrefix}UnitIdMap`].get(category_id) || [];

      existingUnits.push(unitEntry); // DB constraint ensures no duplicates
      cachedData[`${selectedPrefix}UnitIdMap`].set(category_id, existingUnits);
      cache.setCache(cacheKey, cachedData, 3600);
    }

    // ✅ Minimal response payload
    res.status(201).json({
      id,
      category_id,
      unit_id,
      category_name,
      unit_name
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      // Send error response with meaningful message
      const { category_name, unit_name } = req.body;
      res.status(400).json({
        error: 'Duplicate category-unit combination',
        message: `The combination of category '${category_name}' and unit '${unit_name}' already exists. Please choose a different unit or category.`
      });

    } else {
      // Handle other errors
      console.error('Error inserting category name and unit name combination:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing your request.'
      });
    }
  }
};

exports.updateCategoryUnit = async (req, res) => {
  try {
    const db = getDb();
    const CategoryUnits = db.categoryUnits;
    const Categories = db.categories;
    const Units = db.units;
    const { id } = req.params;
    const { user_id, financial_year } = req.body;

    // Step 1: Fetch original record before update
    const originalCategoryUnit = await CategoryUnits.findOne({ where: { id } });

    const [updated] = await CategoryUnits.update(req.body, { where: { id } });

    if (updated) {
      const updatedCategoryUnit = await CategoryUnits.findOne({
        where: { id },
        attributes: [
          'id',
          'category_id',
          'unit_id',
          [db.sequelize.col('category.name'), 'category_name'],
          [db.sequelize.col('unit.name'), 'unit_name'],
          [db.sequelize.col('category.type'), 'category_type']
        ],
        include: [
          { model: Categories, as: 'category', attributes: [] },
          { model: Units, as: 'unit', attributes: [] }
        ]
      });

      // 🔁 Cache update
      const { category_id, category_type, unit_id, unit_name, category_name } = updatedCategoryUnit.dataValues;
      const selectedPrefix = category_type === 1 ? "purchase" : "sale";
      const cacheKey = `${user_id}_${financial_year}`;
      const cachedData = cache.getCache(cacheKey);

      if (cachedData?.[`${selectedPrefix}UnitIdMap`] instanceof Map) {
        const unitEntry = { id: unit_id, name: unit_name.toLowerCase().trim() };

        // Remove old entry if category_id or unit_id changed
        const oldCategoryId = originalCategoryUnit.category_id;
        const oldUnitId = originalCategoryUnit.unit_id;

        if (oldCategoryId !== category_id || oldUnitId !== unit_id) {
          const oldUnits = cachedData[`${selectedPrefix}UnitIdMap`].get(oldCategoryId) || [];
          const cleanedOldUnits = oldUnits.filter(u => u.id !== oldUnitId);
          cachedData[`${selectedPrefix}UnitIdMap`].set(oldCategoryId, cleanedOldUnits);
        }

        // Add new entry
        const existingUnits = cachedData[`${selectedPrefix}UnitIdMap`].get(category_id) || [];
        existingUnits.push(unitEntry);
        cachedData[`${selectedPrefix}UnitIdMap`].set(category_id, existingUnits);
        cache.setCache(cacheKey, cachedData, 3600);
      }

      res.status(200).json({
        id: updatedCategoryUnit.id,
        category_id: updatedCategoryUnit.category_id,
        unit_id: updatedCategoryUnit.unit_id,
        category_name,
        unit_name
      });
    } else {
      res.status(404).json({ error: 'Category Unit not found' });
    }
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const { category_name, unit_name } = req.body;
      res.status(400).json({
        error: 'Duplicate category-unit combination',
        message: `The combination of category '${category_name}' and unit '${unit_name}' already exists. Please choose a different unit or category.`
      });
    } else {
      console.error('Error updating category unit:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while updating the category unit.'
      });
    }
  }
};

exports.deleteCategoryUnit = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const CategoryUnits = db.categoryUnits;
    const Categories = db.categories;
    const Units = db.units;
    const Entries = db.entry;

    // Fetch the category_unit record by ID
    const categoryUnit = await CategoryUnits.findOne({
      where: { id: id },
      attributes: [
        'id',
        'category_id',
        'unit_id',
        'user_id',
        'financial_year',
        [db.sequelize.col('category.name'), 'category_name'],
        [db.sequelize.col('unit.name'), 'unit_name'],
        [db.sequelize.col('category.type'), 'category_type']
      ],
      include: [
        { model: Categories, as: 'category', attributes: [] },
        { model: Units, as: 'unit', attributes: [] }
      ]
    });
    if (!categoryUnit) {
      return res.status(404).json({ error: 'Not Found', message: 'Category Unit not found' });
    }

    const { category_id, unit_id, user_id, financial_year, category_name, unit_name, category_type } = categoryUnit.dataValues;

    // Check if the combination of category_id and unit_id exists in entries
    const isCombinationReferenced = await Entries.findOne({
      where: { category_id, unit_id },
    });

    if (isCombinationReferenced) {
      return res.status(400).json({
        error: 'Foreign Key Constraint',
        message: `Cannot delete: The combination of category (${category_name}) and unit (${unit_name}) is actively referenced.`,
        detail: `This mapping is used in entries/invoices and must be removed before deletion.`
      });
    }

    // Proceed with deletion
    const deleted = await CategoryUnits.destroy({ where: { id } });
    if (!deleted) {
      return res.status(404).json({ error: 'Not Found', message: 'Category Unit not found' });
    }

    // 🔁 Cache cleanup
    const cacheKey = `${user_id}_${financial_year}`;
    const cachedData = cache.getCache(cacheKey);
    const selectedPrefix = category_type === 1 ? "purchase" : "sale";

    if (cachedData?.[`${selectedPrefix}UnitIdMap`] instanceof Map) {
      const existingUnits = cachedData[`${selectedPrefix}UnitIdMap`].get(category_id) || [];
      const cleanedUnits = existingUnits.filter(u => u.id !== unit_id);
      cachedData[`${selectedPrefix}UnitIdMap`].set(category_id, cleanedUnits);
      cache.setCache(cacheKey, cachedData, 3600);
    }

    res.status(200).json({ message: 'Category Unit deleted successfully' });
  } catch (error) {
    console.error('Error deleting category unit:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while deleting the category unit.'
    });
  }
};
