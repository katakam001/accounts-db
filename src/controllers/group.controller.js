const { getDb } = require("../utils/getDb");
const cache = require("../services/cache.service"); // ✅ Import shared cache service

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
      },
      attributes: { exclude: ['createdAt', 'updatedAt'] } // 🔥 Exclude date fields
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
      return res.status(404).json({ error: 'Not Found', message: 'Group not found' });
    }

    // Normalize name for consistency
    const normalizedName = name?.trim();

    group.name = normalizedName;
    group.description = description;
    group.date_updated = new Date();
    group.user_id = user_id;
    group.financial_year = financial_year;

    await group.save();

    const cacheKey = `${group.user_id}_${group.financial_year}`;
    const cachedData = cache.getCache(cacheKey);

    if (cachedData?.groupMap instanceof Map) {
      // Step 1: Find the old key by matching group ID
      let oldKey = null;
      for (const [key, value] of cachedData.groupMap.entries()) {
        if (value === group.id) {
          oldKey = key;
          break;
        }
      }
      // Step 2: Remove old entry
      if (oldKey) {
        cachedData.groupMap.delete(oldKey);
      }
      // Step 3: Insert updated entry
      cachedData.groupMap.set(normalizedName.toLowerCase(), group.id);
      // Step 4: Write back to cache
      cache.setCache(cacheKey, cachedData, 3600);
    }

    res.status(200).json(group);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const groupName = name;
      res.status(400).json({
        error: 'Duplicate group name',
        message: `The group '${groupName}' already exists. Please choose a different name.`
      });
    } else {
      console.error('Error updating group:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while updating the group.'
      });
    }
  }
};

// Delete Group
exports.groupDelete = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const Group = db.group;

    // Check if the group exists
    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Attempt to delete the group
    await group.destroy();
    const cacheKey = `${group.user_id}_${group.financial_year}`;
    const cachedData = cache.getCache(cacheKey);

    if (cachedData?.groupMap instanceof Map) {
      const normalizedName = group.name.toLowerCase();
      cachedData.groupMap.delete(normalizedName);
      cache.setCache(cacheKey, cachedData, 3600);
    }
    // Successful deletion
    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({
        error: 'foreign key constraint',
        message: `Cannot delete group due to foreign key constraint.`,
        detail: error.parent.detail || error.message, // Provide only relevant database details
      });
    } else {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
};

exports.groupCreate = async (req, res) => {
  const { name, description, user_id, financial_year } = req.body;
  try {
    const db = getDb();
    const Group = db.group;

    // Normalize name for consistency
    const normalizedName = name?.trim();
    const newGroup = await Group.create({
      name: normalizedName,
      description,
      user_id,
      financial_year
    });

    const cacheKey = `${newGroup.user_id}_${newGroup.financial_year}`;
    const cachedData = cache.getCache(cacheKey);

    if (cachedData?.groupMap instanceof Map) {
      cachedData.groupMap.set(normalizedName.toLowerCase(), newGroup.id);
      cache.setCache(cacheKey, cachedData, 3600); // refresh TTL
    }

    res.status(201).send(newGroup);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      const groupName = name;
      res.status(400).json({
        error: 'Duplicate group name',
        message: `The group '${groupName}' already exists. Please choose a different name.`
      });
    } else {
      console.error('Error creating group:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while creating the group.'
      });
    }
  }
};
