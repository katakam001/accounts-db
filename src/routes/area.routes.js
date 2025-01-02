const { authJwt } = require("../middleware");
const controller = require("../controllers/area.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/areas',[authJwt.verifyToken], controller.getAllAreas);
  app.post('/api/areas',[authJwt.verifyToken], controller.createArea);
  app.put('/api/areas/:id',[authJwt.verifyToken], controller.updateArea);
  app.delete('/api/areas/:id',[authJwt.verifyToken], controller.deleteArea);
};
