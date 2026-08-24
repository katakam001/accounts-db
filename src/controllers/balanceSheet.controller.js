const { getDb } = require('../utils/getDb');
const { calculateBalanceSheetReport } = require('../services/balanceSheet.service');
const { uploadToS3 } = require("../services/s3Upload.service");

exports.calculateBalanceSheet = async (req, res) => {
    const userId = req.body.userId;
    const financialYear = req.body.financialYear;
    const fromDate = req.body.fromDate ? new Date(req.body.fromDate) : null;
    const toDate = req.body.toDate ? new Date(req.body.toDate) : null;

    const db = getDb();

    const result = await calculateBalanceSheetReport({
        db,
        userId,
        financialYear,
        fromDate,
        toDate
    });

    res.json(result);
};

exports.exportBalanceSheetHorizontalToPDF = async (req, res) => {
    const userId = req.query.userId;
    const financialYear = req.query.financialYear;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
    const companyName = req.query.companyName;
    const city = req.query.city;

    const db = getDb();
    const Exports = db.exports;

    let exportRecord;

    try {
        // Step 1: Generate balance sheet data
        const result = await calculateBalanceSheetReport({
            db,
            userId,
            financialYear,
            fromDate,
            toDate
        });

        const { left: leftGroups, right: rightGroups } = result;

        const inputKeyTimestamp = new Date().toISOString();

        // Step 2: Insert export record with status = 0 (DATA GENERATED)
        exportRecord = await Exports.create({
            file_type: 'horizontalBalanceSheet',
            financial_year: financialYear,
            status: 0,
            user_id: userId,
            input_key: '',
            input_key_timestamp: inputKeyTimestamp,
            output_key: '',
            output_key_timestamp: null
        });

        const exportId = exportRecord.id;

        // Step 3: Prepare payload
        const data = {
            userId,
            financialYear,
            companyName,
            cityName: city,
            reportTitle: "Horizontal Balance Sheet Report",
            reportDate: getFinancialYearEndDate(financialYear),
            leftGroups,
            rightGroups,
            leftTotal: leftGroups.reduce((sum, g) => sum + (g?.outerAmount || 0), 0),
            rightTotal: rightGroups.reduce((sum, g) => sum + (g?.outerAmount || 0), 0)
        };

        const buffer = Buffer.from(JSON.stringify(data));
        const fileSize = buffer.length;

        // Step 4: Determine size tier
        let sizeTier = "small";
        if (fileSize > 1024 * 1024 * 2.0) {
            sizeTier = "large";
        } else if (fileSize > 1024 * 1024 * 1.0) {
            sizeTier = "medium";
        }

        const keyPrefix = `pdf-inputs/${sizeTier}/${userId}/`;
        const fileName = `horizontalBalanceSheet_${financialYear}_${Date.now()}.json`;

        // Step 5: Upload to S3
        let s3Key;
        try {
            s3Key = await uploadToS3({
                keyPrefix,
                fileName,
                dataBuffer: buffer,
                contentType: 'application/json',
                metadata: {
                    exportId: exportId.toString(),
                    userId: userId.toString(),
                    fileType: 'horizontalBalanceSheet',
                    financialYear,
                    generatedAt: inputKeyTimestamp
                }
            });
        } catch (uploadErr) {
            console.error('❌ S3 upload failed:', uploadErr);
            await exportRecord.update({ status: 5 }); // S3 INPUT KEY UPLOAD FAILED
            return res.status(500).json({ error: 'Failed to upload input file to S3.' });
        }

        // Step 6: Update export record with input key and status = 1 (INTRANSIT)
        await exportRecord.update({
            input_key: s3Key,
            status: 1
        });

        console.log(`✅ Horizontal Balance Sheet PDF input uploaded to S3 at ${s3Key}`);
        res.status(200).send({ message: 'Horizontal Balance Sheet PDF input successfully uploaded to S3 and tracked.' });

    } catch (err) {
        console.error('❌ Horizontal Balance Sheet data generation failed:', err);
        if (exportRecord) {
            await exportRecord.update({ status: 4 }); // DATA GENERATION FAILED
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

function getFinancialYearEndDate(financialYear) {
  const [, endYear] = financialYear.split("-");
  return `${endYear}-03-31`;
}