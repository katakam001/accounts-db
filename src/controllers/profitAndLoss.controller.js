const { getDb } = require('../utils/getDb');
const { calculateProfitAndLossReport } = require('../services/profitAndLoss.service');

exports.calculateprofitAndLoss = async (req, res) => {
    const userId = req.body.userId;
    const financialYear = req.body.financialYear;
    const fromDate = req.body.fromDate ? new Date(req.body.fromDate) : null;
    const toDate = req.body.toDate ? new Date(req.body.toDate) : null;

    const db = getDb();

    const result = await calculateProfitAndLossReport({
        db,
        userId,
        financialYear,
        fromDate,
        toDate
    });

    res.json(result);
};
