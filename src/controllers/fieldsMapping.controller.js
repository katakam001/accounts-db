const {getDb} = require("../utils/getDb");

exports.getFieldsMapping = async (req, res) => {
  const { category_id } = req.query;
  try {
    const db = getDb();
    const FieldsMapping = db.fieldsMapping;
    const Categories = db.categories;
    const Fields = db.fields;
    const whereCondition = category_id ? { category_id } : {};
    const fieldsMapping = await FieldsMapping.findAll({
      where: whereCondition,
      attributes: [
        'id',
        'category_id',
        'field_id',
        'field_type',
        'required',
        'field_category', // Include field_category
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
    const fieldMapping = await FieldsMapping.create(req.body);
    res.status(201).json(fieldMapping);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateFieldMapping = async (req, res) => {
  try {
    const db = getDb();
    const FieldsMapping = db.fieldsMapping;
    const { id } = req.params;
    const [updated] = await FieldsMapping.update(req.body, { where: { id } });
    if (updated) {
      const updatedFieldMapping = await FieldsMapping.findOne({ where: { id } });
      res.status(200).json(updatedFieldMapping);
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
