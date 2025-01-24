const { getDb } = require("../utils/getDb");

exports.getAllLocations = async (req, res) => {
  try {
    const db = getDb();
    const [results, metadata] = await db.sequelize.query('SELECT * FROM locations');
    console.log('Sending response for getAllLocations');
    res.status(200).json(results);
    return; // Return after sending response
  } catch (error) {
    console.error('Error retrieving data:', error);
    console.log('Sending error response for getAllLocations');
    res.status(500).json({ error: 'Internal Server Error' });
    return; // Return after sending response
  }
};

exports.getLocationById = async (req, res) => {
  const { id } = req.params;

  try {
    const db = getDb();
    const [results, metadata] = await db.sequelize.query(
      'SELECT * FROM locations WHERE id = $1',
      {
        bind: [id],
        type: db.sequelize.QueryTypes.SELECT
      }
    );
    console.log('Sending response for getLocationById');
    res.status(200).json(results);
    return; // Return after sending response
  } catch (error) {
    console.error('Error executing query:', error);
    console.log('Sending error response for getLocationById');
    res.status(500).json({ error: 'Internal Server Error' });
    return; // Return after sending response
  }
};
