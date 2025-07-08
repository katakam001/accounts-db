const {getDb} = require("../utils/getDb");

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
    const categoryUnit = await CategoryUnits.create(req.body);

    const newCategoryUnit = await CategoryUnits.findOne({
      where: { id: categoryUnit.id },
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

    res.status(201).json(newCategoryUnit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCategoryUnit = async (req, res) => {
  try {
    const db = getDb();
    const CategoryUnits = db.categoryUnits;
    const Categories = db.categories;
    const Units = db.units;
    const { id } = req.params;
    
    const [updated] = await CategoryUnits.update(req.body, { where: { id } });
    if (updated) {
      const updatedCategoryUnit = await CategoryUnits.findOne({
        where: { id },
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
      
      res.status(200).json(updatedCategoryUnit);
    } else {
      throw new Error('Category Unit not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCategoryUnit = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const CategoryUnits = db.categoryUnits;
    const Entries = db.entry;

    // Fetch the category_unit record by ID
    const categoryUnit = await CategoryUnits.findOne({ where: { id } });
    if (!categoryUnit) {
      return res.status(404).json({ message: 'Category Unit not found' });
    }

    const { category_id, unit_id } = categoryUnit;

    // Check if the combination of category_id and unit_id exists in entries
    const isCombinationReferenced = await Entries.findOne({
      where: { category_id, unit_id },
    });
    console.log(isCombinationReferenced);

    if (isCombinationReferenced) {
      return res.status(400).json({
        error: 'foreign key constraint',
        message: `Cannot delete category_units: The combination of category_id (${category_id}) and unit_id (${unit_id}) is actively referenced.`,
        detail: `The combination of category_id (${category_id}) and field_id (${unit_id}) is actively referenced in invoices`, // Provide only relevant database details
      });
    }

    // Proceed with deletion if no references exist
    const deletedCategoryUnit = await CategoryUnits.destroy({ where: { id } });

    if (!deletedCategoryUnit) {
      return res.status(404).json({ message: 'Category Unit not found' });
    }

    // Successful deletion
    res.status(200).json({ message: 'Category Unit deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
