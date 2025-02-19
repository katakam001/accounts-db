const { authJwt } = require("../middleware");
const controller = require("../controllers/admin.controller");

module.exports = function(app) {
  // Route to login as another user (admin only)
  app.post("/api/admin/login-as-user", [authJwt.verifyAdminToken], controller.loginAsUser);

  // Example of other admin routes
  app.get("/api/admin/users", [authJwt.verifyAdminToken], controller.getUsersForAdmin);
};
