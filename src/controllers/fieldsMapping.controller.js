const { getDb } = require("../utils/getDb");

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

    // Fetch the field name from the fields table
    const field = await Fields.findOne({ where: { id: fieldMapping.field_id } });

    // Fetch the category name from the categories table
    const category = await Categories.findOne({ where: { id: fieldMapping.category_id } });

    // Combine the field mapping record with the field name and category name
    const result = {
      ...fieldMapping.dataValues,
      field_name: field ? field.field_name : null,
      category_name: category ? category.name : null
    };

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateFieldMapping = async (req, res) => {
  try {
    const db = getDb();
    const FieldsMapping = db.fieldsMapping;
    const Fields = db.fields;
    const Categories = db.categories;
    const { id } = req.params;
    const [updated] = await FieldsMapping.update(req.body, { where: { id } });
    if (updated) {
      const updatedFieldMapping = await FieldsMapping.findOne({ where: { id } });
      // Fetch the field name from the fields table
      const field = await Fields.findOne({ where: { id: updatedFieldMapping.field_id } });
      // Fetch the category name from the categories table
      const category = await Categories.findOne({ where: { id: updatedFieldMapping.category_id } });

      // Combine the field mapping record with the field name and category name
      const result = {
        ...updatedFieldMapping.dataValues,
        field_name: field ? field.field_name : null,
        category_name: category ? category.name : null
      };
      res.status(200).json(result);
    } else {
      throw new Error('FieldMapping not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteFieldMapping = async (req, res) => {
  try {
    const db = getDb();
    const FieldsMapping = db.fieldsMapping;
    const { id } = req.params;
    const deletedMapping = await FieldsMapping.destroy({ where: { id } });
    if (deletedMapping) {
      res.status(204).send();
    } else {
      throw new Error('FieldMapping not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
