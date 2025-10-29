const { getTradingAccountData } = require('./tradingAccount/dataFetcher');
const { buildTradingAccountReport } = require('./tradingAccount.service');
const { buildProfitAndLossReport } = require('./profitAndLoss/profitLossBuilder');
const { TRADING_ACCOUNT } = require('../constants/groupMeta');
const { normalize } = require('./tradingAccount/groupUtils');

exports.calculateCombinedTradingAndProfitLossReport = async ({ db, userId, financialYear, fromDate, toDate }) => {
    const {
        groupedAccounts,
        allEntryQuantities,
        cashSaleQuantities,
        stockValuations,
        openingQuantities,
        closingQuantities
    } = await getTradingAccountData({ db, userId, financialYear, fromDate, toDate });

    const tradingLeftSet = new Set(TRADING_ACCOUNT.LEFT_SIDE_GROUPS.map(normalize));
    const tradingRightSet = new Set(TRADING_ACCOUNT.RIGHT_SIDE_GROUPS.map(normalize));

    const trading = buildTradingAccountReport({
        groupedAccounts,
        allEntryQuantities,
        cashSaleQuantities,
        stockValuations,
        openingQuantities,
        closingQuantities,
        leftSet: tradingLeftSet,
        rightSet: tradingRightSet
    });

    const profitLoss = buildProfitAndLossReport({
        groupedAccounts,
        grossProfit: trading.grossProfit,
        grossLoss: trading.grossLoss
    });

    return { trading, profitLoss };
};
