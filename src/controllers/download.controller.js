require('dotenv').config();
// Configure AWS S3
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3 = new S3Client({ region: process.env.AWS_REGION });


exports.getPresignedUrl = async (req, res) => {
  try {
    const { outputKey } = req.query;

    if (!outputKey) {
      return res.status(400).json({ error: "Missing outputKey" });
    }

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: outputKey
    };

    const command = new GetObjectCommand(params);
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes

    res.json({ presignedUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

