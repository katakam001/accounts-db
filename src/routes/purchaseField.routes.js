const { authJwt } = require("../middleware");
const purchaseFieldController = require("../controllers/purchaseFieldController");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/purchase-fields', purchaseFieldController.getAllFieldsWithCategory);
  app.post('/api/purchase-fields', purchaseFieldController.createField);
  app.put('/api/purchase-fields/:id', purchaseFieldController.updateField);
  app.delete('/api/purchase-fields/:id', purchaseFieldController.deleteField);
};
