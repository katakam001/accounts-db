const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");
const app = express();
const createRouter = require('./query/events.js');
const syncAndInjectData = require('./syncAndInject');
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

app.use(
  cookieSession({
    name: "accounts-session",
    keys: ["COOKIE_SECRET"], // should use as secret environment variable
    httpOnly: true,
    sameSite: 'strict'
  })
);

// database
const db = require("../src/models");

const router = createRouter(db.sequelize);
app.use(router);

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
// Invoke the sync and inject function
syncAndInjectData().then(() => {
  // Start the application server
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
  });
});


