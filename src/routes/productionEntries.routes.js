const { authJwt } = require("../middleware");
const controller = require("../controllers/productionEntries.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/production_entries', [authJwt.verifyToken], controller.getAllProductionEntries);
  app.post('/api/production_entries', [authJwt.verifyToken], controller.createProductionEntry);
  app.put('/api/production_entries/:id', [authJwt.verifyToken], controller.updateProductionEntry);
  app.delete('/api/production_entries/:id', [authJwt.verifyToken], controller.deleteProductionEntry);
};
