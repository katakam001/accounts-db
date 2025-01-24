const { getDb } = require("../utils/getDb");

exports.getConsolidatedStockDetails = async (req, res) => {
  const { itemIds, userId, financialYear } = req.query;

  try {
    const db = getDb();
    const ConsolidatedStockRegister = db.consolidated_stock_register;

    // Split the concatenated string into an array of item IDs
    const itemIdsArray = itemIds.split(',').map(id => parseInt(id, 10));

    const consolidatedStockDetails = await ConsolidatedStockRegister.findAll({
      where: {
        item_id: itemIdsArray,
        user_id: userId,
        financial_year: financialYear
      }
    });

    const formattedDetails = consolidatedStockDetails.reduce((acc, row) => {
      acc[row.item_id] = row;
      return acc;
    }, {});

    res.json(formattedDetails);
  } catch (error) {
    console.error('Error fetching consolidated stock details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
