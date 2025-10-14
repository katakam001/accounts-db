const { getDb } = require("../utils/getDb");

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
  const { name } = req.body;

  try {
    const db = getDb();
    const Units = db.units;
    const unit = await Units.create(req.body);
    res.status(201).json(unit);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      // Send error response with meaningful message
      res.status(400).json({
        error: 'Duplicate unit name detected',
        message: `The unit name "${name}" already exists. Please choose a unique name.`
      });
    } else {
      // Handle other errors
      console.error('Error inserting unit:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing your request.'
      });
    }
  }
};

exports.updateUnit = async (req, res) => {
  const { name } = req.body;
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
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      res.status(400).json({
        error: 'Duplicate unit name detected',
        message: `The unit name "${name}" already exists. Please choose a unique name.`
      });
    } else {
      console.error('Error while updating the unit:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing your request.'
      });
    }
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
