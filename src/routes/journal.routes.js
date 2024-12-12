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

  app.get("/api/journal-entries", controller.getJournalEntries);
  app.put("/api/journal-entries/:id", controller.updateJournalEntry);
  app.delete("/api/journal-entries/:id", controller.deleteJournalEntry);
  app.post("/api/journal-entries", controller.createJournalEntryWithItems);

};

