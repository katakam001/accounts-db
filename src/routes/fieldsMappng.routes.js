const { authJwt } = require("../middleware");
const fieldsMappingController = require("../controllers/fieldsMapping.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/fieldsMapping', fieldsMappingController.getFieldsMapping);
  app.post('/api/fieldsMapping', fieldsMappingController.createFieldMapping);
  app.put('/api/fieldsMapping/:id', fieldsMappingController.updateFieldMapping);
  app.delete('/api/fieldsMapping/:id', fieldsMappingController.deleteFieldMapping);
};
