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

  app.get("/api/ledger/export-account-copy-to-pdf", [authJwt.verifyToken], controller.exportAccountCopyToPDF);
  app.get("/api/ledger/export-ledger-to-pdf", [authJwt.verifyToken], controller.exportLedgerToPDF);
  app.get("/api/ledger/exportLedgerToExcel", [authJwt.verifyToken], controller.exportToExcel);
  app.get("/api/ledger/fetchLedgerData", [authJwt.verifyToken], controller.getLedger);
  app.get("/api/ledger/fetch-account-copy/:accountId", [authJwt.verifyToken], controller.getAccountCopy);
};
