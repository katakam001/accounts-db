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
  try {
    const db = getDb();
    const Fields = db.fields;
    const { id } = req.params;
    const deletedField = await Fields.destroy({ where: { id } });
    if (deletedField) {
      res.status(204).send();
    } else {
      throw new Error('Field not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
