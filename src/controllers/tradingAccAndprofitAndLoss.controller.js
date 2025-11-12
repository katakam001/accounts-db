const { getDb } = require('../utils/getDb');
const { calculateCombinedTradingAndProfitLossReport } = require('../services/combinedTradeAndProfitAndLoss.service');
const { uploadToS3 } = require("../services/s3Upload.service");

exports.calculateTradingAccountAndprofitAndLoss = async (req, res) => {
    const userId = req.body.userId;
    const financialYear = req.body.financialYear;
    const fromDate = req.body.fromDate ? new Date(req.body.fromDate) : null;
    const toDate = req.body.toDate ? new Date(req.body.toDate) : null;

    const db = getDb();

    const result = await calculateCombinedTradingAndProfitLossReport({
        db,
        userId,
        financialYear,
        fromDate,
        toDate
    });

    res.json(result);
};

exports.exportTradingAndPAndLToPDF = async (req, res) => {
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
        // 🔹 Step 1: Generate Trading + P&L data
        const { trading, profitLoss } = await calculateCombinedTradingAndProfitLossReport({
            db,
            userId,
            financialYear,
            fromDate,
            toDate
        });

        const inputKeyTimestamp = new Date().toISOString();

        // 🔹 Step 2: Insert export record
        exportRecord = await Exports.create({
            file_type: 'tradingAccountProfitAndLoss',
            financial_year: financialYear,
            status: 0,
            user_id: userId,
            input_key: '',
            input_key_timestamp: inputKeyTimestamp,
            output_key: '',
            output_key_timestamp: null
        });

        const exportId = exportRecord.id;

        // 🔹 Step 3: Prepare combined payload
        const formatResult = (label, amount) => label && amount ? { label, amount } : null;

        const data = {
            userId,
            financialYear,
            companyName,
            cityName: city,
            reportTitle: "Trading Account & Profit and Loss Report",
            reportDate: getFinancialYearEndDate(financialYear),
            trading: {
                ...trading,
                grossResult: formatResult(
                    trading.grossProfit ? 'Gross Profit' : trading.grossLoss ? 'Gross Loss' : null,
                    trading.grossProfit ?? trading.grossLoss
                )
            },
            profitAndLoss: {
                ...profitLoss,
                grossResult: formatResult(
                    profitLoss.netProfit ? 'Net Profit' : profitLoss.netLoss ? 'Net Loss' : null,
                    profitLoss.netProfit ?? profitLoss.netLoss
                )
            }
        };

        const buffer = Buffer.from(JSON.stringify(data));
        const fileSize = buffer.length;

        // 🔹 Step 4: Determine size tier
        let sizeTier = "small";
        if (fileSize > 1024 * 1024 * 2.0) {
            sizeTier = "large";
        } else if (fileSize > 1024 * 1024 * 1.0) {
            sizeTier = "medium";
        }

        const keyPrefix = `pdf-inputs/${sizeTier}/${userId}/`;
        const fileName = `tradingAndPAndL_${financialYear}_${Date.now()}.json`;

        // 🔹 Step 5: Upload to S3
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
                    fileType: 'tradingAccountProfitAndLoss',
                    financialYear,
                    generatedAt: inputKeyTimestamp
                }
            });
        } catch (uploadErr) {
            console.error('❌ S3 upload failed:', uploadErr);
            await exportRecord.update({ status: 5 }); // S3 INPUT KEY UPLOAD FAILED
            return res.status(500).json({ error: 'Failed to upload input file to S3.' });
        }

        // 🔹 Step 6: Update export record
        await exportRecord.update({
            input_key: s3Key,
            status: 1
        });

        console.log(`✅ Combined Trading & P&L PDF input uploaded to S3 at ${s3Key}`);
        res.status(200).send({ message: 'Combined Trading & P&L PDF input successfully uploaded to S3 and tracked.' });

    } catch (err) {
        console.error('❌ Combined report generation failed:', err);
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
