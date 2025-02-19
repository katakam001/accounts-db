const { getDb } = require("../utils/getDb");

exports.insertFinancialYear = async (req, res) => {
    const user_id = req.userId;  // Get user_id from req.userId
    const { financial_year } = req.body;

    try {
        const db = getDb();
        FinancialYearTracking = db.financial_year_tracking;
        // Check if the record already exists
        const existingRecord = await FinancialYearTracking.findOne({
            where: { user_id, financial_year },
        });

        if (existingRecord) {
            return res.status(200).json({ message: 'Record for this financial year already exists.' });
        }

        // Insert the new record
        await FinancialYearTracking.create({
            user_id,
            financial_year
        });

        res.status(201).json({ message: 'Financial year data inserted successfully.' });
    } catch (error) {
        console.log(error);
        console.error('Error inserting financial year data:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
