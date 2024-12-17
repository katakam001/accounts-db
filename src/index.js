const express = require("express");
const cors = require("cors");
const cookieSession = require("cookie-session");
const app = express();
const createRouter = require('./query/events.js');

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
    name: "bezkoder-session",
    keys: ["COOKIE_SECRET"], // should use as secret environment variable
    httpOnly: true,
    sameSite: 'strict'
  })
);

// database
const db = require("../src/models");
const Role = db.role;

db.sequelize.sync();

const router = createRouter(db.sequelize);
app.use(router);

// force: true will drop the table if it already exists
// db.sequelize.sync({force: true}).then(() => {
//   console.log('Drop and Resync Database with { force: true }');
//   initial();
// });

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to bezkoder application." });
});

// routes
require("../src/routes/auth.routes")(app);
require("../src/routes/user.routes")(app);
require("../src/routes/account.routes")(app);
require("../src/routes/group.routes")(app);
require("./routes/journal.routes.js")(app);
require("./routes/trail-balance.routes.js")(app);
require("./routes/cash.routes.js")(app);
require("./routes/purchaseCategory.routes.js")(app);
require("./routes/purchaseField.routes.js")(app);
require("./routes/unit.routes.js")(app);
require("./routes/categoryUnit.routes.js")(app);
require("./routes/purchaseEntry.routes.js")(app);
// set port, listen for requests
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

function initial() {
  Role.create({
    id: 1,
    name: "user",
  });

  Role.create({
    id: 2,
    name: "moderator",
  });

  Role.create({
    id: 3,
    name: "admin",
  });
}
