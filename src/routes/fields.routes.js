const { authJwt } = require("../middleware");
const fieldsController = require("../controllers/fields.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/fields', fieldsController.getFields);
  app.post('/api/fields', fieldsController.createField);
  app.put('/api/fields/:id', fieldsController.updateField);
  app.delete('/api/fields/:id', fieldsController.deleteField);
};
