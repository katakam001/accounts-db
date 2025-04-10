const { authJwt } = require("../middleware");
const categoryController = require("../controllers/category.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/categories',[authJwt.verifyToken], categoryController.getAllCategories);
  app.post('/api/categories',[authJwt.verifyToken], categoryController.createCategory);
  app.put('/api/categories/:id',[authJwt.verifyToken], categoryController.updateCategory);
  app.delete('/api/categories/:id',[authJwt.verifyToken], categoryController.deleteCategory);
};
