const { authJwt } = require("../middleware");
const controller = require("../controllers/unit.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/units', controller.getAllUnits);
  app.post('/api/units', controller.createUnit);
  app.put('/api/units/:id', controller.updateUnit);
  app.delete('/api/units/:id', controller.deleteUnit);
};