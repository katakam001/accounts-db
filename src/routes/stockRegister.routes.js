const { authJwt } = require("../middleware");
const stockRegisterController = require("../controllers/stockRegisterController");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/generate-stock-register", [authJwt.verifyToken], stockRegisterController.generateStockRegister);
};
