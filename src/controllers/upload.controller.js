const { checkQueueDepth, monitorQueueAndConsume } = require("../services/sqs.service");
require('dotenv').config();
// Configure AWS S3
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3 = new S3Client({ region: "ap-south-2" });
let isMonitoringActive = false; // 🔹 Prevent duplicate monitoring sessions

// Function to Generate Presigned URL
exports.getPresignedUrl = async (req, res) => {
  try {
    const { fileName } = req.query;
    if (!fileName) {
      return res.status(400).json({ error: "Missing file name" });
    }

    // 🔹 Extract file extension dynamically
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const validExtensions = ["pdf", "csv", "txt", "xlsx"];
    let prefix = validExtensions.includes(fileExtension) ? `${fileExtension}/` : "other/";
    //  Define metadata dynamically
    let metadata = {};

    if (fileExtension === "pdf") {
      const { statementType, bankName, accountId, userId, financialYear,fileSize } = req.query;
      if (statementType === "bank") {
        metadata = { statementType, bankName, accountId, userId, financialYear,fileSize };
      } else {
        metadata = { statementType, userId, financialYear,fileSize };
      }
      let sizeTier = "small"; // default
      if (parseInt(fileSize, 10) > 1024 * 1024 * 1.07) {
        sizeTier = "large";
      } else if (parseInt(fileSize, 10) > 1024 * 1024 * 0.5) {
        sizeTier = "medium";
      }

      prefix = `pdf/${sizeTier}/`; // 👈 Update prefix based on size tier
    } else if (fileExtension === "csv") {
      const { userId, financialYear, type, taxType,fileSize } = req.query;
      metadata = { userId, financialYear, type, taxType,fileSize };
    } else {
      metadata = { fileType: fileExtension, uploadedAt: new Date().toISOString() };
    }

    // console.log(metadata);
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${prefix}${fileName}`,
      ContentType: 'application/octet-stream',
      Metadata: metadata
    };
    const presignedUrl = await getSignedUrl(s3, new PutObjectCommand(params), { expiresIn: 300 });
    res.json({ presignedUrl });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.startMonitoring = async (req, res) => {
  try {
    if (isMonitoringActive) {
      return res.status(200).json({ message: "Monitoring is already running!" });
    }

    console.log("Received request to start queue monitoring...");
    isMonitoringActive = true;
    const resetMonitoringFlag = () => { // ✅ This function resets monitoring state
      isMonitoringActive = false;
    };
    // 🔹 Wait until SQS contains messages before starting monitoring
    const waitForMessages = async () => {
      let retries = 0;
      while (retries < 6) { // 🔹 Retry for up to 3 minutes
        const messageCount = await checkQueueDepth();
        if (messageCount > 0) {
          console.log("Messages detected in SQS. Starting consumer...");
          monitorQueueAndConsume(messageCount, resetMonitoringFlag); // Start consumer only when messages exist
          return;
        }
        console.log("Waiting for Lambda to complete processing...");
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s before retrying
        retries++;
      }
      console.log("Lambda processing might have failed. Monitoring skipped.");
      isMonitoringActive = false; // Reset flag if no messages found after retries
    };

    setTimeout(waitForMessages, 0); // Run async check in the background

    res.json({ message: "Monitoring will start when messages are available in SQS!" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

