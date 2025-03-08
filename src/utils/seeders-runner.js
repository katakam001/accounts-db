const fs = require('fs');
const path = require('path');
const {getDb} = require("./getDb");

const seedersPath = path.join(__dirname, '../seeders');
const seederFiles = fs.readdirSync(seedersPath);

(async () => {
    const db = getDb();
  const queryInterface = db.sequelize.getQueryInterface();
  for (const seederFile of seederFiles) {
    const seederFileName = seederFile;

    // Check if the seeder has already been executed
    const [results] = await queryInterface.sequelize.query(
      `SELECT * FROM seeder_logs WHERE seeder_file_name = '${seederFileName}'`
    );

    if (results.length === 0) {
      console.log(`Executing seeder: ${seederFileName}`);
      const seeder = require(path.join(seedersPath, seederFile));
      await seeder.up(queryInterface, db.Sequelize);

      // Log the seeder execution
      await queryInterface.sequelize.query(
        `INSERT INTO seeder_logs (seeder_file_name) VALUES ('${seederFileName}')`
      );
    } else {
      console.log(`Seeder ${seederFileName} has already been executed.`);
    }
  }
  console.log('Seeding completed.');
  process.exit(0);
})();
