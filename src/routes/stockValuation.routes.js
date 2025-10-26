const { authJwt } = require("../middleware");
const controller = require("../controllers/stockValulation.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/stock-valuation', [authJwt.verifyToken], controller.fetchStockValuation);
  app.get('/api/stock-valuation/generate', [authJwt.verifyToken], controller.generateStockValuation);
  app.put('/api/stock-valuation/:id', [authJwt.verifyToken], controller.updateStockValuation);
};
