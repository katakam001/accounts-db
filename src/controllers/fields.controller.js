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

    // Normalize field_name
    if (req.body.field_name) {
      req.body.field_name = req.body.field_name.trim();
    }

    const field = await Fields.create(req.body);
    res.status(201).json(field);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const name = req.body.field_name;
      res.status(400).json({
        error: 'Duplicate field name',
        message: `The field '${name}' already exists. Please choose a different name.`
      });
    } else {
      console.error('Error creating field:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while creating the field.'
      });
    }
  }
};

exports.updateField = async (req, res) => {
  try {
    const db = getDb();
    const Fields = db.fields;
    const { id } = req.params;

    // Normalize field_name
    if (req.body.field_name) {
      req.body.field_name = req.body.field_name.trim();
    }

    const [updated] = await Fields.update(req.body, { where: { id } });
    if (!updated) {
      return res.status(404).json({ error: 'Not Found', message: 'Field not found' });
    }

    const updatedField = await Fields.findOne({ where: { id } });
    res.status(200).json(updatedField);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const name = req.body.field_name;
      res.status(400).json({
        error: 'Duplicate field name',
        message: `The field '${name}' already exists. Please choose a different name.`
      });
    } else {
      console.error('Error updating field:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while updating the field.'
      });
    }
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
