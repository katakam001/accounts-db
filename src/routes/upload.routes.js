const { authJwt } = require("../middleware");
const controller = require("../controllers/upload.controller");
const upload = require("../config/multer-config"); // Multer config file

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
    next();
  });

  // Add the route for file upload
  app.post("/api/upload/bank-statement-pdf", [authJwt.verifyToken, upload], controller.uploadFile);
  app.post("/api/upload/entries-upload", [authJwt.verifyToken, upload], controller.entriesupload);
  app.post("/api/upload/validate-entries-upload", [authJwt.verifyToken, upload], controller.validateEntriesupload);
};
