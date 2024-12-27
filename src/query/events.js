const express = require('express');

function createRouter(db) {
  const router = express.Router();

  router.get('/api/locations', async (req, res) => {
    try {
      const [results, metadata] = await db.query('SELECT * FROM locations');
      res.status(200).json(results);
    } catch (error) {
      console.error('Error retrieving data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  router.get('/api/locations/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const [results, metadata] = await db.query(
        'SELECT * FROM locations WHERE id = $1',
        {
          bind: [id],
          type: db.QueryTypes.SELECT
        }
      );
      res.status(200).json(results);
    } catch (error) {
      console.error('Error executing query:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // POST request handler
  router.post('/api/items', async (req, res) => {
    const { id, firstname, lastname, email } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO items (firstname, lastname,email) VALUES ($1, $2,$3,$4) RETURNING *',
        [id, firstname, lastname, email]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error inserting data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // PUT request handler to update data
  router.put('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;
    try {
      const result = await db.query(
        'UPDATE items SET email = $1 WHERE id = $2 RETURNING *',
        [email, id]
      );
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error updating data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // DELETE request handler to delete data
  router.delete('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM items WHERE id = $1', [id]);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
}

module.exports = createRouter;
