const {getDb} = require("../utils/getDb");
const { getGroupMappingTree } = require('../services/groupMapping.service');

exports.groupToAccountMappingTree = async (req, res) => {
  try {
    const { userId, financialYear, rootGroupName } = req.query;
    const data = await getGroupMappingTree(userId, financialYear, rootGroupName);
    res.json(data);
  } catch (error) {
    console.error('Error fetching hierarchical data:', error);
    res.status(500).send('Server Error');
  }
};

exports.addGroupMapping = async (req, res) => {
  try {
    const db = getDb();
    const GroupMapping = db.groupMapping;
    const Group = db.group;
    const { parent_id, group_name, user_id, financial_year } = req.body; // Get user_id and financial_year from request body

    // Fetch the group_id from the group_list table based on the group name, user_id, and financial_year
    const group = await Group.findOne({ 
      where: { 
        name: group_name,
        user_id: user_id,
        financial_year: financial_year
      }
    });

    if (!group) {
      return res.status(404).send('Group not found');
    }

    // Create a new GroupMapping entry
    const newGroupMapping = await GroupMapping.create({
      parent_id,
      group_id: group.id,
      user_id,
      financial_year
    });

    // Fetch the newly created GroupMapping entry along with the associated Group name
    const groupMappingWithGroup = await GroupMapping.findOne({
      where: { id: newGroupMapping.id },
      include: [
        {
          model: Group,
          attributes: [['name', 'name']] // Select the name attribute as name
        }
      ]
    });

    res.status(201).json(groupMappingWithGroup);
  } catch (error) {
    console.error('Error adding GroupMapping:', error);
    res.status(500).send('Server Error');
  }
};

exports.updateGroupMapping = async (req, res) => {
  try {
    const db = getDb();
    const GroupMapping = db.groupMapping;
    const { id, name } = req.body;
    const group = await GroupMapping.findByPk(id);
    if (group) {
      group.name = name;
      await group.save();
      res.status(200).json(group);
    } else {
      res.status(404).send('Group not found');
    }
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).send('Server Error');
  }
};

exports.deleteGroupMapping = async (req, res) => {
  try {
    const db = getDb();
    const GroupMapping = db.groupMapping;
    const { id } = req.params;
    const group = await GroupMapping.findByPk(id, {
      include: {
        model: GroupMapping,
        as: 'children'
      }
    });
    if (group) {
      // Delete child records first
      await GroupMapping.destroy({ where: { parent_id: id } });
      // Delete the parent record
      await group.destroy();
      res.status(200).send(group);
    } else {
      res.status(404).send('Group not found');
    }
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).send('Server Error');
  }
};
