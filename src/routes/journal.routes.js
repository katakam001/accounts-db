const { authJwt } = require("../middleware");
const controller = require("../controllers/journal.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/journal-entries", [authJwt.verifyToken], controller.getJournalEntries);
  app.get("/api/journal-entries/daybook", [authJwt.verifyToken], controller.combinedBookListForDayBook);
  app.get("/api/journal-entries/exportDaybookToPDF", [authJwt.verifyToken], controller.exportDaybookToPDF);
  app.get("/api/journal-entries/exportDaybookToExcel", [authJwt.verifyToken], controller.exportDaybookToExcel);
  app.get("/api/journal-entries/:id", [authJwt.verifyToken], controller.getJournalEntryById);
  app.put("/api/journal-entries/:id", [authJwt.verifyToken], controller.updateJournalEntry);
  app.delete("/api/journal-entries/:id", [authJwt.verifyToken], controller.deleteJournalEntry);
  app.post("/api/journal-entries", [authJwt.verifyToken], controller.createJournalEntryWithItems);
};
