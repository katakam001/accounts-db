const multer = require("multer");

// Configure storage to use memory
const storage = multer.memoryStorage();

// Configure Multer with a file size limit (e.g., 10MB)
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  fileFilter: (req, file, cb) => {
    // Validate file type
    const allowedMimeTypes = [
      "application/pdf",          // For PDF
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // For .xlsx
      "application/vnd.ms-excel"  // For .xls
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // Accept the file
    } else {
      cb(new Error("Invalid file type. Only PDF and Excel files are allowed."), false);
    }
  },
});

// Export the middleware for a single file upload
module.exports = upload.single("file"); // Change the field name to "file"
