const { authJwt } = require("../middleware");
const controller = require("../controllers/account.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });
  app.get("/api/accounts",[authJwt.verifyToken],controller.accountList);
  app.get("/api/accounts/:name?/:id?", [authJwt.verifyToken], controller.getAccount); // New route to get account by name or id
  app.put("/api/accounts/:id",[authJwt.verifyToken], controller.accountUpdate);
  app.delete("/api/accounts/:id",[authJwt.verifyToken],controller.accountDelete);
  app.post("/api/accounts",[authJwt.verifyToken],controller.accountCreate);

};

