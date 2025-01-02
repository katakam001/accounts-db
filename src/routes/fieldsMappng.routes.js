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

  app.get('/api/fieldsMapping',[authJwt.verifyToken], fieldsMappingController.getFieldsMapping);
  app.post('/api/fieldsMapping',[authJwt.verifyToken], fieldsMappingController.createFieldMapping);
  app.put('/api/fieldsMapping/:id',[authJwt.verifyToken], fieldsMappingController.updateFieldMapping);
  app.delete('/api/fieldsMapping/:id',[authJwt.verifyToken], fieldsMappingController.deleteFieldMapping);
};
