const { authJwt } = require("../middleware");
const fieldController = require("../controllers/field.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/fields', fieldController.getFields);
  app.post('/api/fields', fieldController.createField);
  app.put('/api/fields/:id', fieldController.updateField);
  app.delete('/api/fields/:id', fieldController.deleteField);
};
