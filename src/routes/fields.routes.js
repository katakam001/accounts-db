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

  app.get('/api/fields',[authJwt.verifyToken], fieldsController.getFields);
  app.post('/api/fields',[authJwt.verifyToken], fieldsController.createField);
  app.put('/api/fields/:id',[authJwt.verifyToken], fieldsController.updateField);
  app.delete('/api/fields/:id',[authJwt.verifyToken], fieldsController.deleteField);
};
