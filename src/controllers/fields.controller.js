const db = require("../models");
const Fields = db.fields;

exports.getFields = async (req, res) => {
  try {
    const fields = await Fields.findAll();
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
