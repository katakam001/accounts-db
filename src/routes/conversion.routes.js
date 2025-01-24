const { authJwt } = require("../middleware");
const controller = require("../controllers/conversion.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/conversions', [authJwt.verifyToken], controller.getAllConversions);
  app.post('/api/conversions', [authJwt.verifyToken], controller.createConversion);
  app.put('/api/conversions/:id', [authJwt.verifyToken], controller.updateConversion);
  app.delete('/api/conversions/:id', [authJwt.verifyToken], controller.deleteConversion);
};
