const { authJwt } = require("../middleware");
const controller = require("../controllers/openingStock.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/opening-stock', [authJwt.verifyToken], controller.getAllOpeningStock);
  app.post('/api/opening-stock', [authJwt.verifyToken], controller.createOpeningStock);
  app.put('/api/opening-stock/:id', [authJwt.verifyToken], controller.updateOpeningStock);
  app.delete('/api/opening-stock/:id', [authJwt.verifyToken], controller.deleteOpeningStock);
};
