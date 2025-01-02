const {getDb} = require("../utils/getDb");

exports.getAllUnits = async (req, res) => {
  try {
    const db = getDb();
    const Units = db.units;
    const units = await Units.findAll();
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
  try {
    const db = getDb();
    const Units = db.units;
    const { id } = req.params;
    const deleted = await Units.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error('Unit not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
