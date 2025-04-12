const {getDb} = require("../utils/getDb");

exports.getAllItems = async ({ userId, financialYear }) => {
    try {
      const db = getDb();
      const Item = db.items;
  
      const whereCondition = {
        ...(userId && { user_id: userId }),
        ...(financialYear && { financial_year: financialYear })
      };
  
      const items = await Item.findAll({
        attributes: ['id', 'name', 'user_id', 'financial_year'],
        where: whereCondition
      });
      return items;

    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  };