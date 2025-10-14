const { checkQueueDepth, monitorQueueAndConsume } = require("../services/sqs.service");
const { getDb } = require("../utils/getDb");
// Configure AWS S3
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3 = new S3Client({ region: process.env.AWS_REGION });
let isMonitoringActive = false; // 🔹 Prevent duplicate monitoring sessions
const cache = require("../services/cache.service"); // ✅ Import shared cache service

// Function to Generate Presigned URL
exports.getPresignedUrl = async (req, res) => {
  try {
    const { fileName } = req.query;
    if (!fileName) {
      return res.status(400).json({ error: "Missing file name" });
    }

    const db = getDb();
    const UploadHistory = db.uploadHistory;

    const fileExtension = fileName.split('.').pop().toLowerCase();
    const validExtensions = ["pdf", "csv", "txt", "xlsx"];
    let prefix = validExtensions.includes(fileExtension) ? `${fileExtension}/` : "other/";
    let metadata = {};
    let fileType = "other";
    let userId, financialYear;

    // 🔹 PDF logic
    if (fileExtension === "pdf") {
      const { statementType, bankName, accountId, userId: uid, financialYear: fy, fileSize } = req.query;
      userId = uid;
      financialYear = fy;

      if (statementType === "bank") {
        fileType = "bankStatement";
        metadata = { statementType, bankName, accountId, userId, financialYear, fileSize, fileType };
      } else if (statementType === "trailBalance") {
        fileType = "trailBalanceUpload";
        metadata = { statementType, userId, financialYear, fileSize, fileType };
      }

      let sizeTier = "small";
      if (parseInt(fileSize, 10) > 1024 * 1024 * 1.07) sizeTier = "large";
      else if (parseInt(fileSize, 10) > 470 * 1024) sizeTier = "medium";

      prefix = `pdf/${sizeTier}/`;

      // 🔹 CSV logic
    } else if (fileExtension === "csv") {
      const { userId: uid, financialYear: fy, type, taxType, fileSize, saleMode } = req.query;
      userId = uid;
      financialYear = fy;

      const typeMap = {
        1: "purchase",
        2: "creditSale",
        8: "cashSale",
        5: "creditNote",
        6: "debitNote",
      };

      const taxMap = {
        cgst: "Cgst",
        igst: "Igst",
        tcs: "Tcs"
      };

      const typeLabel = typeMap[type];
      const taxLabel = taxMap[taxType?.toLowerCase()];

      fileType = (typeLabel && taxLabel) ? `${typeLabel}${taxLabel}` : "csvOther";
      metadata = { userId, financialYear, type, taxType, fileSize, saleMode, fileType };
    } else {
      metadata = { fileType: fileExtension, uploadedAt: new Date().toISOString() };
    }

    // 🔹 Step 1: Insert into upload_history with status = 1
    const uploadRecord = await UploadHistory.create({
      user_id: userId,
      financial_year: financialYear,
      file_name: fileName,
      file_type: fileType,
      status: 1,
      started_at: new Date()
    });

    // 🔹 Step 2: Add batchId to metadata
    metadata.batchId = uploadRecord.id.toString();

    const key = `${prefix}${Date.now()}_${fileName}`;
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${prefix}${fileName}`,
      ContentType: 'application/octet-stream',
      Metadata: metadata
    };

    let presignedUrl;

    // 🔹 Step 3: Try generating presigned URL
    try {
      presignedUrl = await getSignedUrl(s3, new PutObjectCommand(params), { expiresIn: 300 });

      // 🔹 Step 4: Update status to 2 (URL generated)
      await uploadRecord.update({ status: 2 });
    } catch (err) {
      console.error('❌ Failed to generate presigned URL:', err);

      // 🔹 Step 5: Update status to 3 (URL generation failed)
      await uploadRecord.update({
        status: 3,
        error_message: err.message
      });

      return res.status(500).json({ error: 'Failed to generate presigned URL' });
    }

    // 🔹 Final response
    res.json({
      presignedUrl,
      batchId: uploadRecord.id.toString()
    });


  } catch (error) {
    console.error('❌ Unexpected error:', error);
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

exports.getUploadHistory = async (req, res) => {
  try {
    const db = getDb();
    const UploadHistory = db.uploadHistory;

    const { userId, financialYear } = req.query;

    const whereClause = {
      ...(userId && { user_id: userId }),
      ...(financialYear && { financial_year: financialYear })
    };

    const historyList = await UploadHistory.findAll({
      where: whereClause,
      order: [['started_at', 'DESC']],
      raw: true
    });

    const enrichedHistory = historyList.map((upload) => {
      const {
        id: batchId,
        status,
        total_messages,
        processed_messages,
        skipped_messages
      } = upload;

      const showCounts = status !== 6 && status !== 3 && status !== 4;

      let finalProcessed = processed_messages;
      let finalSkipped = skipped_messages;
      let finalTotal = total_messages;

      // 🔄 If not completed, pull live counts from cache
      if (showCounts && status !== 7) {
        const cachedProcessed = cache.getCache(`${batchId}_processed`);
        const cachedSkipped = cache.getCache(`${batchId}_skipped`);
        const cachedTotal = cache.getCache(`${batchId}_total`);

        finalProcessed = cachedProcessed ?? processed_messages;
        finalSkipped = cachedSkipped ?? skipped_messages;
        finalTotal = cachedTotal ?? total_messages;
      }

      return {
        ...upload,
        processed_messages: showCounts ? finalProcessed : null,
        skipped_messages: showCounts ? finalSkipped : null,
        total_messages: showCounts ? finalTotal : null
      };
    });

    res.json(enrichedHistory);
  } catch (error) {
    console.error('❌ Error fetching upload history:', error.message);
    res.status(500).json({ error: error.message });
  }
};


exports.markUploadFailure = async (req, res) => {
  try {
    const { batchId, errorMessage } = req.body;
    const db = getDb();
    const UploadHistory = db.uploadHistory;

    const record = await UploadHistory.findByPk(batchId);
    if (!record) {
      return res.status(404).json({ error: 'Upload record not found' });
    }

    await record.update({
      status: 4,
      error_message: errorMessage || 'Upload to S3 failed'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Failed to mark upload failure:', error.message);
    res.status(500).json({ error: error.message });
  }
};

