const { authJwt } = require("../middleware");
const controller = require("../controllers/entry.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get('/api/entries', [authJwt.verifyToken], controller.getEntries);
  app.get('/api/entries/getTaxSummary', [authJwt.verifyToken], controller.getTaxSummary);
  app.get('/api/entries/getEntryTypeSummary', [authJwt.verifyToken], controller.getEntryTypeSummary);
  app.get('/api/entries/updationJournalEntries', [authJwt.verifyToken], controller.generateJournalEntriesAndUpdateEntries);
  app.get('/api/entries/:invoice_seq_id/:type', [authJwt.verifyToken], controller.getEntryByInvoiceNumberByType); // Add this line
  app.post('/api/entries/bulkEntries', [authJwt.verifyToken], controller.addEntries);
  app.put('/api/entries/bulkEntries', [authJwt.verifyToken], controller.updateEntries);
  app.delete('/api/entries/bulkEntries/:invoice_seq_id/:type', [authJwt.verifyToken], controller.deleteEntries);
  app.post('/api/entries/bulkCashEntries', [authJwt.verifyToken], controller.addCashEntries);
  app.post('/api/entries/ledgerProcess/:uploadId', [authJwt.verifyToken], controller.triggerLedgerJob);
  app.put('/api/entries/bulkCashEntries', [authJwt.verifyToken], controller.updateCashEntries);
  app.delete('/api/entries/bulkCashEntries/:invoice_seq_id/:type', [authJwt.verifyToken], controller.deleteCashEntries);
};
