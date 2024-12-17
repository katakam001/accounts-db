const { authJwt } = require("../middleware");
const purchaseCategoryController = require("../controllers/purchaseCategory.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/purchase-categories', purchaseCategoryController.getAllCategories);
  app.post('/api/purchase-categories', purchaseCategoryController.createCategory);
  app.put('/api/purchase-categories/:id', purchaseCategoryController.updateCategory);
  app.delete('/api/purchase-categories/:id', purchaseCategoryController.deleteCategory);
};
