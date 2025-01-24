const { authJwt } = require("../middleware");
const controller = require("../controllers/consolidateStockRegister.controller.js");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/consolidated_stock_register', [authJwt.verifyToken], controller.getConsolidatedStockDetails);
};
