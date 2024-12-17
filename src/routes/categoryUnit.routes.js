const { authJwt } = require("../middleware");
const controller = require("../controllers/categoryUnit.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/category-units', controller.getCategoryUnitsByCategoryId);
  app.post('/api/category-units', controller.createCategoryUnit);
  app.put('/api/category-units/:id', controller.updateCategoryUnit);
  app.delete('/api/category-units/:id', controller.deleteCategoryUnit);
};

