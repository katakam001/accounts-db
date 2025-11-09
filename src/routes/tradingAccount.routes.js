const { authJwt } = require("../middleware");
const controller = require("../controllers/tradingAccount.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.post("/api/trading-account/report", [authJwt.verifyToken], controller.calculateTradingAccount);
  app.get("/api/trading-account/export-trading-account-to-pdf", [authJwt.verifyToken], controller.exportTradingAccountToPDF);

};

