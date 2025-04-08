const express = require("express");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const path = require('path');
const chokidar = require('chokidar');
const moment = require('moment-timezone');
const app = express();
const syncAndInjectData = require('./syncAndInject');
const { getDb, reloadDb } = require("./utils/getDb");
const { server, broadcast } = require('./websocket'); // Import the WebSocket server and broadcast function

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
      logging: (msg) => {
        const timestamp = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
        console.log(`[${timestamp}] ${msg}`);
      },
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
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    origin: ["http://localhost:4200"],
  })
);

// Middleware for JSON and URL-encoded data (exclude upload.routes)
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/upload")) { // Apply to all routes except `/api/upload`
    express.json()(req, res, next); 
  } else {
    next();
  }
});
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/upload")) { // Apply to all routes except `/api/upload`
    express.urlencoded({ extended: true })(req, res, next);
  } else {
    next();
  }
});

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
require("./routes/admin.routes.js")(app);
require("./routes/financialYearTracking.routes.js")(app);
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
require("./routes/items.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/yield.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/conversion.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/productionEntries.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/stockRegister.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/consolidateStockRegister.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/balance.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/ledger.routes.js")(app); // Updated from purchaseEntry.routes.js
require("./routes/upload.routes.js")(app); // Updated from purchaseEntry.routes.js

// Invoke the sync and inject function
syncAndInjectData(db).then(() => {
  // Start the application server
  const PORT = process.env.PORT || 8443;
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
  });
});

// Attach the Express app to the HTTPS server
server.on('request', app);

// Redirect HTTP to HTTPS
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(301, { 'Location': 'https://' + req.headers.host + req.url });
  res.end();
}).listen(8080, () => {
  console.log('HTTP server is redirecting to HTTPS');
});
