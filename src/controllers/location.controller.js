const { getDb } = require("../utils/getDb");

exports.getAllLocations = async (req, res) => {
  try {
    const db = getDb();
    const [results, metadata] = await db.sequelize.query('SELECT * FROM locations');
    res.status(200).json(results);
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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
    res.status(200).json(results);
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.createItem = async (req, res) => {
  const { id, firstname, lastname, email } = req.body;
  try {
    const db = getDb();
    const [result, metadata] = await db.sequelize.query(
      'INSERT INTO items (firstname, lastname, email) VALUES ($1, $2, $3, $4) RETURNING *',
      {
        bind: [id, firstname, lastname, email],
        type: db.sequelize.QueryTypes.INSERT
      }
    );
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error inserting data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateItem = async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  try {
    const db = getDb();
    const [result, metadata] = await db.sequelize.query(
      'UPDATE items SET email = $1 WHERE id = $2 RETURNING *',
      {
        bind: [email, id],
        type: db.sequelize.QueryTypes.UPDATE
      }
    );
    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error updating data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteItem = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    await db.sequelize.query('DELETE FROM items WHERE id = $1', {
      bind: [id],
      type: db.sequelize.QueryTypes.DELETE
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
