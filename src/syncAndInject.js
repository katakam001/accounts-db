const db = require('./models');
const readData = require('./utils/readData');
const injectData = require('./utils/injectData');

const syncAndInjectData = async () => {
  try {
    // Sync the models
    await db.sequelize.sync();
    console.log('Database & tables created!');

    // Read data from JSON file
    const data = readData();

    // Inject data into the database
    await injectData(db, data);
  } catch (error) {
    console.error('Error syncing database and injecting data:', error);
  }
};
module.exports = syncAndInjectData;

