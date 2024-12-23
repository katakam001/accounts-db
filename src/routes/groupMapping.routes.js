const { authJwt } = require("../middleware");
const controller = require("../controllers/groupMapping.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/groupMappingTree", controller.groupToAccountMappingTree);
  app.post('/api/addGroupMapping', controller.addGroupMapping);
  // Route to update a group mapping
  app.put('/api/updateGroupMapping/:id', controller.updateGroupMapping);

// Route to delete a group mapping
app.delete('/api/deleteGroupMapping/:id', controller.deleteGroupMapping);

};