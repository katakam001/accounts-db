const { authJwt } = require("../middleware");
const controller = require("../controllers/closingStockValulation.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/closing-stock-valuation', [authJwt.verifyToken], controller.fetchClosingStockValuation);
  app.get('/api/closing-stock-valuation/generate', [authJwt.verifyToken], controller.generateClosingStockValuation);
  app.put('/api/closing-stock-valuation/:id', [authJwt.verifyToken], controller.updateClosingStockValuation);
};
