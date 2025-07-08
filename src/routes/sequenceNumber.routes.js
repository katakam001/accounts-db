const { authJwt } = require("../middleware"); // Authentication middleware
const controller = require("../controllers/sequenceNumber.controller"); // Adjust this based on your controller file name

module.exports = function (app) {
  // Middleware for setting response headers
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
    next();
  });

  // Define the routes with authentication middleware
  app.get('/api/seqNo/getInvoicesNo', [authJwt.verifyToken], controller.getEntriesSNo);
};
