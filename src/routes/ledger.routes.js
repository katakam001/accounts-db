const { authJwt } = require("../middleware");
const controller = require("../controllers/ledger.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/ledger/exportLedgerToPDF", [authJwt.verifyToken], controller.exportToPDF);
  app.get("/api/ledger/exportLedgerToExcel", [authJwt.verifyToken], controller.exportToExcel);
  app.get("/api/ledger/:accountId", [authJwt.verifyToken], controller.getLedgerForAccount);
  app.get("/api/ledger/updated/:accountId", [authJwt.verifyToken], controller.getUpdatedLedger);
};
