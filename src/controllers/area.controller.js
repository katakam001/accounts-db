const {getDb} = require("../utils/getDb");

exports.getAllAreas = async (req, res) => {
  try {
    const db = getDb();
    const Area = db.areas;
    const { userId, financialYear } = req.query;
    
    const whereClause = {
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear })
    };
    
    const areas = await Area.findAll({ where: whereClause });
    
    res.json(areas);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

exports.createArea = async (req, res) => {
  try {
    const db = getDb();
    const Area = db.areas;
    const area = await Area.create(req.body);
    res.status(201).json(area);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateArea = async (req, res) => {
  try {
    const db = getDb();
    const Area = db.areas;
    const { id } = req.params;
    const [updated] = await Area.update(req.body, { where: { id } });
    if (updated) {
      const updatedArea = await Area.findOne({ where: { id } });
      res.status(200).json(updatedArea);
    } else {
      throw new Error('Area not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteArea = async (req, res) => {
  try {
    const db = getDb();
    const Area = db.areas;
    const { id } = req.params;
    const deleted = await Area.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      throw new Error('Area not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
