const db = require("../models");
const Units = db.units;
const PurchaseCategories = db.purchaseCategories;
const CategoryUnits = db.categoryUnits;


exports.getCategoryUnitsByCategoryId = async (req, res) => {
  try {
    const { category_id } = req.query;
    const whereCondition = category_id ? { category_id } : {};
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
        { model: PurchaseCategories, as: 'category', attributes: [] },
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
    const categoryUnit = await CategoryUnits.create(req.body);
    res.status(201).json(categoryUnit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCategoryUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await CategoryUnits.update(req.body, { where: { id } });
    if (updated) {
      const updatedCategoryUnit = await CategoryUnits.findOne({ where: { id } });
      res.status(200).json(updatedCategoryUnit);
    } else {
      throw new Error('Category Unit not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCategoryUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await CategoryUnits.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error('Category Unit not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
