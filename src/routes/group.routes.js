const { authJwt } = require("../middleware");
const controller = require("../controllers/group.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/groups",[authJwt.verifyToken], controller.groupList);
  app.put("/api/groups/:id",[authJwt.verifyToken], controller.groupUpdate);
  app.delete("/api/groups/:id",[authJwt.verifyToken], controller.groupDelete);
  app.post("/api/groups",[authJwt.verifyToken], controller.groupCreate);

};

