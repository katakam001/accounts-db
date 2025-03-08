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
  app.get('/api/entries/updationJournalEntries',  controller.generateJournalEntriesAndUpdateEntries);
  app.get('/api/entries/:id', [authJwt.verifyToken], controller.getEntryById); // Add this line
  app.post('/api/entries/bulk', [authJwt.verifyToken], controller.addEntries);
  app.put('/api/entries/bulk', [authJwt.verifyToken], controller.updateEntries);
  app.delete('/api/entries/:invoiceNumber', [authJwt.verifyToken], controller.deleteEntries);
};
