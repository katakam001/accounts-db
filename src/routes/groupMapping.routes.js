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

  app.get("/api/groupMappingTree",[authJwt.verifyToken], controller.groupToAccountMappingTree);
  app.post('/api/addGroupMapping',[authJwt.verifyToken], controller.addGroupMapping);
  // Route to update a group mapping
  app.put('/api/updateGroupMapping/:id',[authJwt.verifyToken], controller.updateGroupMapping);

// Route to delete a group mapping
app.delete('/api/deleteGroupMapping/:id',[authJwt.verifyToken], controller.deleteGroupMapping);

};