const multer = require("multer");

// Configure storage to use memory
const storage = multer.memoryStorage();

// Configure Multer with a file size limit (e.g., 10MB)
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});

module.exports = upload.single("pdf");
