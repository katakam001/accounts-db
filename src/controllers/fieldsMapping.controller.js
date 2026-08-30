const { getDb } = require("../utils/getDb");
const cache = require("../services/cache.service"); // ✅ Import shared cache service

exports.getFieldsMapping = async (req, res) => {
  const { userId, financialYear, categoryId } = req.query;
  try {
    const db = getDb();
    const FieldsMapping = db.fieldsMapping;
    const Categories = db.categories;
    const Fields = db.fields;

    const whereCondition = {};
    if (userId) {
      whereCondition.user_id = userId;
    }
    if (financialYear) {
      whereCondition.financial_year = financialYear;
    }
    if (categoryId) {
      whereCondition.category_id = categoryId;
    }

    const fieldsMapping = await FieldsMapping.findAll({
      where: whereCondition,
      attributes: [
        'id',
        'category_id',
        'field_id',
        'field_type',
        'required',
        'field_category', // Include field_category
        'account_id', // Include field_category
        'exclude_from_total', // Include exclude_from_total
        [db.sequelize.col('category.name'), 'category_name'],
        [db.sequelize.col('field.field_name'), 'field_name']
      ],
      include: [
        {
          model: Categories,
          as: 'category',
          attributes: []
        },
        {
          model: Fields,
          as: 'field',
          attributes: []
        }
      ]
    });
    res.json(fieldsMapping);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.createFieldMapping = async (req, res) => {
  try {
    const db = getDb();
    const FieldsMapping = db.fieldsMapping;
    const Fields = db.fields;
    const Categories = db.categories;

    // Create the field mapping record
    const fieldMapping = await FieldsMapping.create(req.body);

    // Fetch field and category names
    const field = await Fields.findOne({ where: { id: fieldMapping.field_id } });
    const category = await Categories.findOne({ where: { id: fieldMapping.category_id } });

    // Determine prefix from category type
    const selectedPrefix = category?.type === 1 ? "purchase" : "sale";
    const cacheKey = `${fieldMapping.user_id}_${fieldMapping.financial_year}`;
    const cachedData = cache.getCache(cacheKey) || {};
    const mapKey = `${selectedPrefix}DynamicFieldsMap`;

    // ✅ Only update if map exists
    const existingMap = cachedData[mapKey];
    if (existingMap instanceof Map) {
      const entry = {
        field_id: fieldMapping.field_id,
        field_name: field?.field_name || null,
        field_type: fieldMapping.field_type,
        required: fieldMapping.required,
        field_category: fieldMapping.field_category,
        exclude_from_total: fieldMapping.exclude_from_total,
        tax_account_id: fieldMapping.account_id
      };

      if (!existingMap.has(fieldMapping.category_id)) {
        existingMap.set(fieldMapping.category_id, []);
      }

      existingMap.get(fieldMapping.category_id).push(entry);
      cache.setCache(cacheKey, cachedData, 3600); // ✅ Refresh TTL
    }

    // Construct final response
    const result = {
      ...fieldMapping.dataValues,
      field_name: field?.field_name || null,
      category_name: category?.name || null
    };

    res.status(201).json(result);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const categoryName = req.body.category_name;
      const fieldName = req.body.field_name;

      res.status(400).json({
        error: 'Duplicate field mapping',
        message: `The field '${fieldName}' is already mapped to the category '${categoryName}'. Please choose a different combination.`
      });
    } else {
      console.error('Error creating field mapping:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while creating the field mapping.'
      });
    }
  }
};

exports.updateFieldMapping = async (req, res) => {
  try {
    const db = getDb();
    const FieldsMapping = db.fieldsMapping;
    const Fields = db.fields;
    const Categories = db.categories;
    const { id } = req.params;

    // Step 1: Fetch original mapping before update
    const beforeupdatedFieldMapping = await FieldsMapping.findOne({ where: { id } });
    if (!beforeupdatedFieldMapping) {
      return res.status(404).json({ error: 'Not Found', message: 'Field mapping not found' });
    }

    // Step 2: Perform update
    const [updated] = await FieldsMapping.update(req.body, { where: { id } });
    if (!updated) {
      return res.status(404).json({ error: 'Not Found', message: 'Field mapping not found after update' });
    }

    // Step 3: Fetch updated mapping and related names
    const updatedFieldMapping = await FieldsMapping.findOne({ where: { id } });
    const field = await Fields.findOne({ where: { id: updatedFieldMapping.field_id } });
    const category = await Categories.findOne({ where: { id: updatedFieldMapping.category_id } });

    // Step 4: Cache cleanup and update
    const selectedPrefix = category?.type === 1 ? "purchase" : "sale";
    const cacheKey = `${updatedFieldMapping.user_id}_${updatedFieldMapping.financial_year}`;
    const cachedData = cache.getCache(cacheKey) || {};
    const mapKey = `${selectedPrefix}DynamicFieldsMap`;
    const existingMap = cachedData[mapKey];

    if (existingMap instanceof Map) {
      // Remove old entry from old category
      const oldCategoryId = beforeupdatedFieldMapping.category_id;
      const oldFieldId = beforeupdatedFieldMapping.field_id;
      const oldFields = existingMap.get(oldCategoryId) || [];
      const filteredFields = oldFields.filter(f => f.field_id !== oldFieldId);
      existingMap.set(oldCategoryId, filteredFields);

      // Add new entry to updated category
      const entry = {
        field_id: updatedFieldMapping.field_id,
        field_name: field?.field_name || null,
        field_type: updatedFieldMapping.field_type,
        required: updatedFieldMapping.required,
        field_category: updatedFieldMapping.field_category,
        exclude_from_total: updatedFieldMapping.exclude_from_total,
        tax_account_id: updatedFieldMapping.account_id
      };

      if (!existingMap.has(updatedFieldMapping.category_id)) {
        existingMap.set(updatedFieldMapping.category_id, []);
      }
      existingMap.get(updatedFieldMapping.category_id).push(entry);

      cache.setCache(cacheKey, cachedData, 3600); // Refresh TTL
    }

    // Step 5: Construct response
    const result = {
      ...updatedFieldMapping.dataValues,
      field_name: field?.field_name || null,
      category_name: category?.name || null
    };

    res.status(200).json(result);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const fieldName = req.body.field_name;
      const categoryName = req.body.category_name;

      res.status(400).json({
        error: 'Duplicate field mapping',
        message: `The field '${fieldName}' is already mapped to the category '${categoryName}'. Please choose a different combination.`
      });
    } else {
      console.error('Error updating field mapping:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while updating the field mapping.'
      });
    }
  }
};

exports.deleteFieldMapping = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const FieldsMapping = db.fieldsMapping;
    const Categories = db.categories;

    // Fetch the fields_mapping record by ID to retrieve field_id and category_id
    const fieldMapping = await FieldsMapping.findOne({ where: { id } });
    if (!fieldMapping) {
      return res.status(404).json({ message: 'FieldMapping not found' });
    }

    const { field_id, category_id, user_id, financial_year } = fieldMapping;

    // Check if the combination of category_id and field_id exists in entries and entry_fields
    const [isCombinationReferenced] = await db.sequelize.query(
      `SELECT e.category_id, ef.field_id
       FROM entries e
       JOIN entry_fields ef ON e.id = ef.entry_id
       WHERE e.category_id = :category_id AND ef.field_id = :field_id
       LIMIT 1`,
      {
        replacements: { category_id, field_id }
      }
    );

    if (isCombinationReferenced.length > 0) {
      return res.status(400).json({
        error: 'foreign key constraint',
        message: `Cannot delete fields_mapping: The combination of category_id (${category_id}) and field_id (${field_id}) is actively referenced.`,
        detail: `The combination of category_id (${category_id}) and field_id (${field_id}) is actively referenced in invoices`, // Provide only relevant database details
      });
    }

    // Proceed with deletion if no references exist
    const deletedMapping = await FieldsMapping.destroy({ where: { id } });
    if (!deletedMapping) {
      return res.status(404).json({ message: 'FieldMapping record not found' });
    }

    // 🔁 Cache cleanup
    const category = await Categories.findOne({ where: { id: category_id } });
    const selectedPrefix = category?.type === 1 ? "purchase" : "sale";
    const cacheKey = `${user_id}_${financial_year}`;
    const cachedData = cache.getCache(cacheKey);
    const mapKey = `${selectedPrefix}DynamicFieldsMap`;
    const existingMap = cachedData?.[mapKey];

    if (existingMap instanceof Map && existingMap.has(category_id)) {
      const filtered = existingMap.get(category_id).filter(entry => entry.field_id !== field_id);
      if (filtered.length > 0) {
        existingMap.set(category_id, filtered);
      } else {
        existingMap.delete(category_id);
      }
      cache.setCache(cacheKey, cachedData, 3600); // ✅ Refresh TTL
    }

    res.status(200).json({ message: 'FieldMapping deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};