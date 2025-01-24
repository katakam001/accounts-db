const { authJwt } = require("../middleware");
const controller = require("../controllers/yield.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/yields', [authJwt.verifyToken], controller.getAllYields);
  app.post('/api/yields', [authJwt.verifyToken], controller.createYield);
  app.put('/api/yields/:id', [authJwt.verifyToken], controller.updateYield);
  app.delete('/api/yields/:id', [authJwt.verifyToken], controller.deleteYield);
};
