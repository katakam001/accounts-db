const { TRADING_ACCOUNT, PROFIT_LOSS } = require('../constants/groupMeta');
const { normalize } = require('./tradingAccount/groupUtils');
const { getTradingAccountData } = require('./tradingAccount/dataFetcher');
const { buildTradingAccountReport } = require('./tradingAccount.service');
const { buildProfitAndLossReport } = require('./profitAndLoss/profitLossBuilder');
const { injectDynamicChildren } = require('./dynamicGroups.service');


/**
 * Sorts groups based on predefined order
 */
function sortGroups(groups, order) {
  return order.map(name => groups.find(g => g.group === name)).filter(Boolean);
}

/**
 * Generates a Profit & Loss report with net result and sorted groups.
 *
 * @param {Object} params
 * @param {Object} params.db
 * @param {string} params.userId
 * @param {string} params.financialYear
 * @param {Date|null} params.fromDate
 * @param {Date|null} params.toDate
 * @returns {Object} Full report structure for UI rendering
 */
exports.calculateProfitAndLossReport = async ({ db, userId, financialYear, fromDate, toDate }) => {
  // Step 1: Fetch all required data
  const {
    groupedAccounts,
    allEntryQuantities,
    cashSaleQuantities,
    stockValuations,
    openingQuantities,
    closingQuantities
  } = await getTradingAccountData({ db, userId, financialYear, fromDate, toDate });

  const dynamicGroups = await injectDynamicChildren(userId, financialYear, PROFIT_LOSS.RELATIONSHIP_GROUPS);

  // Step 2: Compute gross result from Trading Account logic
  const tradingLeftSet = new Set(TRADING_ACCOUNT.LEFT_SIDE_GROUPS.map(normalize));
  const tradingRightSet = new Set(TRADING_ACCOUNT.RIGHT_SIDE_GROUPS.map(normalize));

  const { grossProfit, grossLoss } = buildTradingAccountReport({
    groupedAccounts,
    allEntryQuantities,
    cashSaleQuantities,
    stockValuations,
    openingQuantities,
    closingQuantities,
    leftSet: tradingLeftSet,
    rightSet: tradingRightSet
  });

    return buildProfitAndLossReport({ groupedAccounts, grossProfit, grossLoss,dynamicGroups });
};
