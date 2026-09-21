const paymentsReceiptsService = require('../services/paymentReceipts.service');
const { getDb } = require("../utils/getDb");

exports.getSummary = async (req, res) => {
    const db = getDb();
    try {
        const { userId, financialYear, fromDate, toDate } = req.body;

        if (!userId || !financialYear || !fromDate || !toDate) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const summary = await paymentsReceiptsService.fetchSummary({
            db,
            userId,
            financialYear,
            fromDate,
            toDate
        });

        res.json(summary);
    } catch (err) {
        console.error('Error fetching Payments & Receipts summary:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
