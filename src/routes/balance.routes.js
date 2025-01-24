const { authJwt } = require("../middleware");
const balanceController = require("../controllers/balance.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/balance", [authJwt.verifyToken], balanceController.getInitialBalance);
};
