const { authJwt } = require("../middleware");
const controller = require("../controllers/copyJob.controller");

module.exports = function (app) {
    // Create a new copy job
    app.post("/api/admin/jobs/create", [authJwt.verifyAdminToken], controller.createJob);

    // Get all jobs for the logged-in admin
    app.get("/api/admin/jobs", [authJwt.verifyAdminToken], controller.getAllJobs);

    // Drill-down: tables for a given job
    app.get('/api/admin/jobs/:jobId/tables', controller.getJobTables);

    // Drill-down: chunks for a given table
    app.get('/api/admin/jobs/tables/:tableId/chunks', controller.getJobChunks);

    // Retry a failed job (dummy for now, wire later)
    app.post("/api/admin/jobs/:id/retry", [authJwt.verifyAdminToken], controller.retryJob);

    // 🔹 Trigger ledger processing for a copy job
    app.post("/api/admin/jobs/:id/ledger", [authJwt.verifyAdminToken], controller.triggerLedgerForCopyJob);
};
