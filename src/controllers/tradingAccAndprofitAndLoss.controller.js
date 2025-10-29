const { getDb } = require('../utils/getDb');
const { calculateCombinedTradingAndProfitLossReport } = require('../services/combinedTradeAndProfitAndLoss.service');

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
