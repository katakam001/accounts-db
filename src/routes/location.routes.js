const { authJwt } = require("../middleware");
const controller = require("../controllers/location.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/locations',[authJwt.verifyToken], controller.getAllLocations);
  app.get('/api/locations/:id',[authJwt.verifyToken], controller.getLocationById);
  app.post('/api/items', [authJwt.verifyToken], controller.createItem);
  app.put('/api/items/:id', [authJwt.verifyToken], controller.updateItem);
  app.delete('/api/items/:id', [authJwt.verifyToken], controller.deleteItem);
};
