const {getDb} = require("../utils/getDb");

exports.groupList = async (req, res) => {
  try {
    const db = getDb();
    const Group = db.group;
    const userId = req.query.userId;
    const financialYear = req.query.financialYear;
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }
    if (!financialYear) {
      return res.status(400).json({ error: 'financialYear query parameter is required' });
    }

    const groups = await Group.findAll({
      where: {
        user_id: userId,
        financial_year: financialYear
      }
    });

    res.status(200).json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.groupUpdate = async (req, res) => {
  const { id } = req.params;
  const { name, description, user_id, financial_year } = req.body;
  try {
    const db = getDb();
    const Group = db.group;
    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).send('Group not found');
    }
    group.name = name;
    group.description = description;
    group.date_updated = new Date();
    group.user_id = user_id;
    group.financial_year = financial_year;
    await group.save();
    res.send(group);
  } catch (error) {
    res.status(500).send(error);
  }
};

// Delete Group
exports.groupDelete = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const Group = db.group;
    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).send('Group not found');
    }
    await group.destroy();
    res.status(200).send({ message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.groupCreate = async (req, res) => {
  const { name, description, user_id, financial_year } = req.body;
  try {
    const db = getDb();
    const Group = db.group;
    const newGroup = await Group.create({
      name,
      description,
      user_id,
      financial_year
    });
    res.status(201).send(newGroup);
  } catch (error) {
    res.status(500).send(error);
  }
};


