const { authJwt } = require("../middleware");
const controller = require("../controllers/trail-balance.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.post("/api/trail-balance-report", controller.getTrailBalance);


};

