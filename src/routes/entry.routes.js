const { authJwt } = require("../middleware");
const controller = require("../controllers/entry.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/entries',[authJwt.verifyToken], controller.getEntries);
  app.post('/api/entries',[authJwt.verifyToken], controller.addEntry);
  app.put('/api/entries/:id',[authJwt.verifyToken], controller.updateEntry);
  app.delete('/api/entries/:id',[authJwt.verifyToken], controller.deleteEntry);
};
