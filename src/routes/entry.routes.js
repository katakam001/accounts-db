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
  app.get('/api/entries/:invoiceNumber/:type', [authJwt.verifyToken], controller.getEntryByInvoiceNumberByType); // Add this line
  app.post('/api/entries/bulk', [authJwt.verifyToken], controller.addEntries);
  app.put('/api/entries/bulk', [authJwt.verifyToken], controller.updateEntries);
  app.delete('/api/entries/:invoiceNumber/:type', [authJwt.verifyToken], controller.deleteEntries);
};
