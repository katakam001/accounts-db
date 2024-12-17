const { authJwt } = require("../middleware");
const  controller = require("../controllers/entry.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/purchase-entries', controller.getEntries);
  app.post('/api/purchase-entries', controller.addEntry);
  app.put('/api/purchase-entries/:id', controller.updateEntry);
  app.delete('/api/purchase-entries/:id', controller.deleteEntry);
};
