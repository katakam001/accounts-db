const { authJwt } = require("../middleware");
const controller = require("../controllers/broker.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/brokers',[authJwt.verifyToken], controller.getAllBrokers);
  app.post('/api/brokers',[authJwt.verifyToken], controller.createBroker);
  app.put('/api/brokers/:id',[authJwt.verifyToken], controller.updateBroker);
  app.delete('/api/brokers/:id',[authJwt.verifyToken], controller.deleteBroker);
};
