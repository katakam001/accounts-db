const fs = require('fs');
const path = require('path');
const { getDb } = require('./getDb');

const seedersPath = path.join(__dirname, '../seeders');
const seederFiles = fs.readdirSync(seedersPath);

(async () => {
  const db = getDb();
  const queryInterface = db.sequelize.getQueryInterface();

  for (const seederFile of seederFiles) {
    const seederFileName = seederFile;

    // Check if the seeder has been executed
    const [results] = await queryInterface.sequelize.query(
      `SELECT * FROM seeder_logs WHERE seeder_file_name = '${seederFileName}'`
    );

    if (results.length > 0) {
      console.log(`Reverting seeder: ${seederFileName}`);
      const seeder = require(path.join(seedersPath, seederFile));

      if (seeder.down) {
        await seeder.down(queryInterface, db.Sequelize);

        // Remove the log entry for the reverted seeder
        await queryInterface.sequelize.query(
          `DELETE FROM seeder_logs WHERE seeder_file_name = '${seederFileName}'`
        );
      } else {
        console.log(`No down method found for seeder: ${seederFileName}`);
      }
    } else {
      console.log(`Seeder ${seederFileName} has not been executed.`);
    }
  }
  console.log('Reversion completed.');
  process.exit(0);
})();
