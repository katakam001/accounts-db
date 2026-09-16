const { getDb } = require("../utils/getDb");
const { getCarryForwardAccounts } = require("../services/balanceSheet.service");
const { uploadToS3 } = require("../services/s3Upload.service");

exports.insertFinancialYear = async (req, res) => {
    const user_id = req.userId;
    const { financial_year } = req.body;

    const db = getDb();
    const FinancialYearTracking = db.financial_year_tracking;
    const UploadHistory = db.uploadHistory;

    let uploadRecord;

    try {
        // Step 1: Check if record exists
        const existingRecord = await FinancialYearTracking.findOne({
            where: { user_id, financial_year },
        });

        if (existingRecord) {
            if (existingRecord.status === 3) {
                return res.status(200).json({
                    message: 'Financial year already exists and is ready.',
                    status: existingRecord.status,
                    error_message: existingRecord.error_message
                });
            }
            if (existingRecord.status === 2) {
                return res.status(200).json({
                    message: 'Financial year already exists and is still processing.',
                    status: existingRecord.status,
                    error_message: existingRecord.error_message
                });
            }
            if (existingRecord.status === 4) {
                console.log(`Retrying financial year creation for user ${user_id}, FY ${financial_year}`);
            }
            if (existingRecord.status === 1) {
                console.log(`Continuing processing for seeded financial year ${financial_year}`);
                // don’t return here → continue to Step 2a and Step 3
            }
        } else {
            // Step 2: Insert new record with status = 1 (default seeded)
            await FinancialYearTracking.create({
                user_id,
                financial_year,
                status: 1,
                error_message: null
            });
        }

        // Step 2a: Check if direct previous financial year exists
        const [startYear] = financial_year.split('-').map(Number);
        const prevFinancialYear = `${startYear - 1}-${startYear}`;

        const prevRecord = await FinancialYearTracking.findOne({
            where: { user_id, financial_year: prevFinancialYear }
        });

        if (!prevRecord) {
            // 🟢 No previous year → new user or first-time setup
            await FinancialYearTracking.update(
                { status: 3, error_message: null },
                { where: { user_id, financial_year } }
            );

            return res.status(201).json({
                message: 'Financial year created successfully. No carry-forward required.',
                status: 3,
                error_message: null,
                batchId: null
            });
        }

        // Step 3: Generate carry-forward accounts
        const { fromDate, toDate } = getFinancialYearDates(prevFinancialYear);

        const groupAccountMap = await getCarryForwardAccounts({
            db,
            userId: user_id,
            financialYear: prevFinancialYear,
            fromDate,
            toDate
        });

        if (!groupAccountMap || groupAccountMap.size === 0) {
            await FinancialYearTracking.update(
                { status: 4, error_message: "No carry-forward accounts found." },
                { where: { user_id, financial_year } }
            );
            return res.status(500).json({
                message: 'No carry-forward accounts found.',
                status: 4,
                error_message: "No carry-forward accounts found."
            });
        }

        const inputKeyTimestamp = new Date().toISOString();

        // Step 4: Insert upload history record
        uploadRecord = await UploadHistory.create({
            user_id,
            financial_year,
            file_name: `carryForward_${financial_year}_${Date.now()}.json`,
            file_type: "carryForwardAccounts",
            status: 1,
            started_at: inputKeyTimestamp
        });

        const batchId = uploadRecord.id;

        // Step 5: Prepare payload
        const data = {
            userId: user_id,
            financialYear: financial_year,
            accountsByGroup: Object.fromEntries(groupAccountMap)
        };

        const buffer = Buffer.from(JSON.stringify(data));
        const fileSize = buffer.length;

        // Step 6: Determine size tier
        let sizeTier = "small";
        if (fileSize > 1024 * 1024 * 2.0) sizeTier = "large";
        else if (fileSize > 1024 * 1024 * 1.0) sizeTier = "medium";

        const keyPrefix = `carry-forward/${sizeTier}/${user_id}/`;
        const fileName = `carryForward_${financial_year}_${Date.now()}.json`;

        // Step 7: Upload to S3
        let s3Key;
        try {
            s3Key = await uploadToS3({
                keyPrefix,
                fileName,
                dataBuffer: buffer,
                contentType: 'application/json',
                metadata: {
                    batchId: batchId.toString(),
                    userId: user_id.toString(),
                    fileType: 'carryForwardAccounts',
                    financialYear: financial_year,
                    generatedAt: inputKeyTimestamp
                }
            });
        } catch (uploadErr) {
            console.error('❌ S3 upload failed:', uploadErr);

            await uploadRecord.update({ status: 4, error_message: uploadErr.message });
            await FinancialYearTracking.update(
                { status: 4, error_message: uploadErr.message },
                { where: { user_id, financial_year } }
            );

            return res.status(500).json({
                message: 'Failed to upload carry-forward file to S3.',
                status: 4,
                error_message: uploadErr.message
            });
        }

        // Step 8: Update upload history and tracking
        await uploadRecord.update({ input_key: s3Key, status: 2 });
        await FinancialYearTracking.update(
            { status: 2, error_message: null },
            { where: { user_id, financial_year } }
        );

        // ✅ Trigger SQS consumer monitoring directly
        const monitorService = require("../services/monitor.service");
        monitorService.startMonitoring();

        res.status(201).json({
            message: 'Financial year inserted and carry-forward accounts uploaded to S3.',
            status: 2,
            error_message: null,
            batchId
        });

    } catch (error) {
        console.error('❌ Error inserting financial year:', error);

        if (uploadRecord) {
            await uploadRecord.update({ status: 6, error_message: error.message });
        }

        await FinancialYearTracking.update(
            { status: 4, error_message: error.message },
            { where: { user_id, financial_year } }
        );

        res.status(500).json({
            message: 'Internal server error.',
            status: 4,
            error_message: error.message
        });
    }
};

function getFinancialYearDates(financialYear) {
    const [startYear, endYear] = financialYear.split('-').map(Number);
    const fromDate = new Date(startYear, 3, 1); // April 1st
    const toDate = new Date(endYear, 2, 31);   // March 31st
    return { fromDate, toDate };
}
