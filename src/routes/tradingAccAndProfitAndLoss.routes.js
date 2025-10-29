const { authJwt } = require("../middleware");
const controller = require("../controllers/tradingAccAndprofitAndLoss.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.post("/api/combine/trading-profit-loss/report", [authJwt.verifyToken], controller.calculateTradingAccountAndprofitAndLoss);

};

