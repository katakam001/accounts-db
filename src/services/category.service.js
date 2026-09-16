const { getDb } = require("../utils/getDb");

exports.fetchCategories = async ({ type, userId, financialYear }) => {
  try {
    const db = getDb();
    const Categories = db.categories;

    const whereClause = {
      ...(type && { type }),
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear })
    };

    const categories = await Categories.findAll({
      attributes: ['id', 'name', 'type', 'user_id', 'financial_year'],
      where: whereClause,
      raw: true // 🔥 returns plain objects
    });

    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    throw new Error('Failed to fetch categories');
  }
};
