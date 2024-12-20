const db = require("../models");
const Fields = db.fields;
const Categories = db.categories;

exports.getFields = async (req, res) => {
  const { category_id } = req.query;
  try {
    const whereCondition = category_id ? { category_id } : {};
    const fields = await Fields.findAll({
      where: whereCondition,
      attributes: [
        'id',
        'category_id',
        'field_name',
        'field_type',
        'required',
        'field_category', // Include field_category
        'exclude_from_total', // Include exclude_from_total
        [db.sequelize.col('category.name'), 'category_name']
      ],
      include: [{
        model: Categories,
        as: 'category',
        attributes: []
      }]
    });
    console.log(fields);
    res.json(fields);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createField = async (req, res) => {
  try {
    const field = await Fields.create(req.body);
    res.status(201).json(field);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateField = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await Fields.update(req.body, { where: { id } });
    if (updated) {
      const updatedField = await Fields.findOne({ where: { id } });
      res.status(200).json(updatedField);
    } else {
      throw new Error('Field not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteField = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Fields.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error('Field not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
