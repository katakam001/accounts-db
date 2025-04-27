const {getDb} = require("../utils/getDb");

exports.getAllUnits = async (req, res) => {
  try {
    const db = getDb();
    const Units = db.units;
    const { userId, financialYear } = req.query;
    
    const whereClause = {
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear })
    };
    
    const units = await Units.findAll({ where: whereClause });
    
    res.json(units);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.createUnit = async (req, res) => {
  try {
    const db = getDb();
    const Units = db.units;
    const unit = await Units.create(req.body);
    res.status(201).json(unit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUnit = async (req, res) => {
  try {
    const db = getDb();
    const Units = db.units;
    const { id } = req.params;
    const [updated] = await Units.update(req.body, { where: { id } });
    if (updated) {
      const updatedUnit = await Units.findOne({ where: { id } });
      res.status(200).json(updatedUnit);
    } else {
      throw new Error('Unit not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUnit = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const Units = db.units;

    // Check if the unit exists
    const unit = await Units.findByPk(id);
    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    // Attempt to delete the unit
    await unit.destroy();

    // Successful deletion
    res.status(200).json({ message: 'Unit deleted successfully' });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({
        error: 'foreign key constraint',
        message: `Cannot delete unit due to foreign key constraint.`,
        detail: error.parent.detail || error.message, // Provide only relevant database details
      });
    } else {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
};
