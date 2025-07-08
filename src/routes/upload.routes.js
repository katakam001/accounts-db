const { authJwt } = require("../middleware");
const controller = require("../controllers/upload.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
    next();
  });

  // Route for Presigned URL Generation
  app.get("/api/upload/get-presigned-url", [authJwt.verifyToken], controller.getPresignedUrl);
  app.post("/api/upload/start-sqs", [authJwt.verifyToken], controller.startMonitoring);

};
