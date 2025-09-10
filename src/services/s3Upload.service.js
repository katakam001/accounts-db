// s3UploadService.js
require('dotenv').config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function uploadToS3({ keyPrefix, fileName, dataBuffer, contentType, metadata = {} }) {
    const s3Key = `${keyPrefix}${fileName}`;

    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: dataBuffer,
        ContentType: contentType,
        Metadata: metadata
    });

    await s3.send(command);
    return s3Key;
}

module.exports = { uploadToS3 };
