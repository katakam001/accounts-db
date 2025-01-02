const { authJwt } = require("../middleware");
const controller = require("../controllers/cash.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/cash-entries",[authJwt.verifyToken],controller.cashBookList);
  app.put("/api/cash-entries/:id",[authJwt.verifyToken], controller.cashEntryUpdate);
  app.delete("/api/cash-entries/:id",[authJwt.verifyToken],controller.cashEntryDelete);
  app.post("/api/cash-entries",[authJwt.verifyToken], controller.cashEntryCreate);

};

