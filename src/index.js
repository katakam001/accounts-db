const express = require("express");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const path = require('path');
const chokidar = require('chokidar');
const app = express();
const syncAndInjectData = require('./syncAndInject');
const { getDb, reloadDb } = require("./utils/getDb");

// Function to reload configuration
async function reloadConfig() {
  console.log('Reloading configuration...');
  delete require.cache[require.resolve('./config/db.config.js')];
  delete require.cache[require.resolve('./config/auth.config.js')];
  global.dbConfig = require('./config/db.config.js');
  global.authConfig = require('./config/auth.config.js');
  console.log('Configuration reloaded:', { dbConfig: global.dbConfig, authConfig: global.authConfig });

  // Re-initialize Sequelize instance
  const Sequelize = require("sequelize");
  global.sequelize = new Sequelize(
    global.dbConfig.DB,
    global.dbConfig.USER,
    global.dbConfig.PASSWORD,
    {
      host: global.dbConfig.HOST,
      dialect: global.dbConfig.dialect,
      logging: console.log,
      pool: {
        max: global.dbConfig.pool.max,
        min: global.dbConfig.pool.min,
        acquire: global.dbConfig.pool.acquire,
        idle: global.dbConfig.pool.idle
      }
    }
  );

  // Reload models
  reloadDb();
  // Sync and inject data
  await syncAndInjectData(getDb());

}

// Watch for changes in the configuration files
console.log('Initializing chokidar watcher...');
const watcher = chokidar.watch([
  path.resolve(__dirname, './config/db.config.js'),
  path.resolve(__dirname, './config/auth.config.js')
], {
  persistent: true,
});

watcher.on('ready', () => {
  console.log('Chokidar watcher is ready and watching files...');
});

watcher.on('change', (path) => {
  console.log(`File ${path} has been changed`);
  reloadConfig();
});

// app.use(cors());
/* for Angular Client (withCredentials) */
app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:4200"],
  })
);

// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));


// Use cookie-parser middleware 
app.use(cookieParser());

// database
const db = getDb();

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to accounting application." });
});

// routes
require("./routes/auth.routes")(app);
require("./routes/user.routes")(app);
require("./routes/account.routes")(app);
require("./routes/group.routes")(app);
require("./routes/journal.routes.js")(app);
require("./routes/trail-balance.routes.js")(app);
require("./routes/cash.routes.js")(app);
require("./routes/category.routes.js")(app); // Updated from purchaseCategory.routes.js
require("./routes/fields.routes.js")(app); // Updated from purchaseField.routes.js
require("./routes/fieldsMappng.routes.js")(app); // Updated from purchaseField.routes.js
require("./routes/unit.routes.js")(app);
require("./routes/categoryUnit.routes.js")(app);
require("./routes/entry.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/groupMapping.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/area.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/broker.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/location.routes.js")(app); // Updated from purchaseEntry.routes.js

// Invoke the sync and inject function
syncAndInjectData(db).then(() => {
  // Start the application server
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
  });
});