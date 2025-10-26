const {getDb} = require("../utils/getDb");
const { buildTree } = require('../utils/buildTree');

exports.getGroupMappingTree = async (userId, financialYear, rootGroupName) => {
  const db = getDb();
  const GroupMapping = db.groupMapping;
  const Group = db.group;

  // Fetch all group mappings with nested children and group name
  const groups = await GroupMapping.findAll({
    where: { user_id: userId, financial_year: financialYear },
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
        model: Group,
        attributes: [['name', 'name']]
      }
    ]
  });

  // Fetch account-to-group associations
  const accounts = await db.sequelize.query(`
    SELECT 
      ag.group_id,
      a.id AS account_id,
      a.name AS account_name
    FROM 
      account_group ag
    JOIN 
      account_list a ON ag.account_id = a.id
    WHERE 
      a.user_id = :user_id
      AND a.financial_year = :financial_year;
  `, {
    type: db.sequelize.QueryTypes.SELECT,
    replacements: { user_id: userId, financial_year: financialYear }
  });

  // Fetch item children for Opening Stock
  const openingStockItems = await db.sequelize.query(`
    SELECT 
      os.item_id,
      i.name AS item_name
    FROM opening_stock os
    JOIN items i ON os.item_id = i.id
    WHERE os.user_id = :user_id
      AND os.financial_year = :financial_year;
  `, {
    type: db.sequelize.QueryTypes.SELECT,
    replacements: { user_id: userId, financial_year: financialYear }
  });

  // Fetch item children for Stock Valuation
  const closingStockItems = await db.sequelize.query(`
    SELECT 
      csv.item_id,
      i.name AS item_name
    FROM stock_valuation csv
    JOIN items i ON csv.item_id = i.id
    WHERE csv.user_id = :user_id
      AND csv.financial_year = :financial_year;
  `, {
    type: db.sequelize.QueryTypes.SELECT,
    replacements: { user_id: userId, financial_year: financialYear }
  });

  // Filter root group if specified
  const filteredGroups = rootGroupName
    ? groups.filter(g => g.Group?.name === rootGroupName)
    : groups;

  // Build tree with injected item children
  return buildTree(filteredGroups, accounts, openingStockItems, closingStockItems);
};

