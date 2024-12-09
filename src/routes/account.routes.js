const { authJwt } = require("../middleware");
const controller = require("../controllers/account.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/accounts", controller.accountList);
  app.put("/api/accounts/:id", controller.accountUpdate);
  app.delete("/api/accounts/:id", controller.accountDelete);
  app.post("/api/accounts", controller.accountCreate);

};

