const db = require("../models");
const PurchaseFields = db.purchaseFields;
const PurchaseCategories = db.purchaseCategories;


exports.getFields = async (req, res) => {
  const { category_id } = req.query;
  try {
    const whereCondition = category_id ? { category_id } : {};
    const fields = await PurchaseFields.findAll({
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
        model: PurchaseCategories,
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
    const field = await PurchaseFields.create(req.body);
    res.status(201).json(field);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateField = async (req, res) => {
  try {
    const { id} = req.params;
    const [updated] = await PurchaseFields.update(req.body, { where: { id } });
    if (updated) {
      const updatedField = await PurchaseFields.findOne({ where: { id } });
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
    const deleted = await PurchaseFields.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error('Field not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
