const {getDb} = require("../utils/getDb");

exports.getFields = async (req, res) => {
  try {
    const db = getDb();
    const Fields = db.fields;
    const { userId, financialYear } = req.query;
    
    const whereClause = {
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear })
    };
    
    const fields = await Fields.findAll({ where: whereClause });
    
    res.json(fields);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createField = async (req, res) => {
  try {
    const db = getDb();
    const Fields = db.fields;
    const field = await Fields.create(req.body);
    res.status(201).json(field);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateField = async (req, res) => {
  try {
    const db = getDb();
    const Fields = db.fields;
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
  const { id } = req.params;
  try {
    const db = getDb();
    const Fields = db.fields;

    // Check if the field exists
    const field = await Fields.findByPk(id);
    if (!field) {
      return res.status(404).json({ message: 'Field not found' });
    }

    // Attempt to delete the field
    await field.destroy();

    // Successful deletion
    res.status(200).json({ message: 'Field deleted successfully' });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({
        error: 'foreign key constraint',
        message: `Cannot delete field due to foreign key constraint.`,
        detail: error.parent.detail || error.message, // Provide only relevant database details
      });
    } else {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
};
