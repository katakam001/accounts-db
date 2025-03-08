const { verifySignUp } = require("../middleware");
const { authJwt } = require("../middleware");
const controller = require("../controllers/auth.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.post(
    "/api/auth/signup",
    [
      verifySignUp.checkDuplicateUsernameOrEmail,
      verifySignUp.checkRolesExisted
    ],
    controller.signup
  );

  app.post("/api/auth/signin", controller.signin);
  app.post("/api/auth/refresh-token", controller.refreshtoken);

  app.post("/api/auth/signout", controller.signout);
  app.post("/api/auth/password-reset", controller.requestPasswordReset);

  app.post("/api/auth/password-reset/confirm", controller.confirmPasswordReset);
  app.post("/api/auth/change-password",[authJwt.verifyToken], controller.changePassword);
};
