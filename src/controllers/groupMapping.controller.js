const db = require("../models");
const GroupMapping = db.groupMapping;
const Group=db.group;
const AccountGroup=db.accountGroup;
const Account = db.account;

exports.groupMappingTree = async (req, res) => {
  try {
    const groups = await GroupMapping.findAll({
      include: [
        {
          model: GroupMapping,
          as: 'children',
          include: {
            model: GroupMapping,
            as: 'children'
          }
        },
        {
          model: Group, // Include the Group model
          attributes: [['name', 'name']], // Select the name attribute as name
        }
      ]
    });


    const buildTree = (data, parentId = null) => {
      return data
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          id: item.id,
          parent_id: item.parent_id,
          group_id: item.group_id,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          name: item.Group.name, // Use the name from Group
          children: buildTree(data, item.id)
        }));
    };
    

    const hierarchicalData = buildTree(groups);
    res.json(hierarchicalData);
  } catch (error) {
    console.error('Error fetching hierarchical data:', error);
    res.status(500).send('Server Error');
  }
};

exports.groupToAccountMappingTree = async (req, res) => {
  try {
    const groups = await GroupMapping.findAll({
      include: [
        {
          model: GroupMapping,
          as: 'children',
          include: {
            model: GroupMapping,
            as: 'children'
          }
        },
        {
          model: Group, // Include the Group model
          attributes: [['name', 'name']], // Select the name attribute as name
        }
      ]
    });

    const accounts = await db.sequelize.query(`
      SELECT 
        ag.group_id,
        a.id AS account_id,
        a.name AS account_name
      FROM 
        account_group ag
      JOIN 
        account_list a ON ag.account_id = a.id;
    `, {
      type: db.sequelize.QueryTypes.SELECT
    });

    const hierarchicalData = buildTree(groups, accounts);
    res.json(hierarchicalData);
  } catch (error) {
    console.error('Error fetching hierarchical data:', error);
    res.status(500).send('Server Error');
  }
};

const buildTree = (data, accounts, parentId = null) => {
  if (!data || !accounts) {
    return [];
  }

  return data
    .filter(item => item.parent_id === parentId)
    .map(item => {
      const children = buildTree(data, accounts, item.id);
      const groupAccounts = accounts
        .filter(account => account.group_id === item.group_id)
        .map(account => ({
          id: account.account_id,
          name: account.account_name
        }));

      return {
        id: item.id,
        parent_id: item.parent_id,
        group_id: item.group_id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        name: item.Group.name, // Use the name from Group
        children: [...children, ...groupAccounts] // Include both children and accounts
      };
    });
};





exports.addGroupMapping = async (req, res) => {
  try {
    const { parent_id, group_name } = req.body;

    // Fetch the group_id from the group_list table based on the group name
    const group = await Group.findOne({ where: { name: group_name } });

    if (!group) {
      return res.status(404).send('Group not found');
    }

    // Create a new GroupMapping entry
    const newGroupMapping = await GroupMapping.create({
      parent_id,
      group_id: group.id
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
