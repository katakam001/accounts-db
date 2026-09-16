const { authJwt } = require("../middleware");
const controller = require("../controllers/profitAndLoss.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.post("/api/profit-and-loss/report", [authJwt.verifyToken], controller.calculateprofitAndLoss);
  app.get("/api/profit-and-loss/export-profit-loss-to-pdf", [authJwt.verifyToken], controller.exportProfitAndLossToPDF);

};

