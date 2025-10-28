const { TRADING_ACCOUNT, PROFIT_LOSS } = require('../constants/groupMeta');
const { normalize } = require('./tradingAccount/groupUtils');
const { getTradingAccountData } = require('./tradingAccount/dataFetcher');
const { getGrossResultFromTradingAccount } = require('./tradingAccount.service');
const { mapFlatGroupsGeneric } = require('./tradingAccount/flatGroups');


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

  // Step 2: Compute gross result from Trading Account logic
  const tradingLeftSet = new Set(TRADING_ACCOUNT.LEFT_SIDE_GROUPS.map(normalize));
  const tradingRightSet = new Set(TRADING_ACCOUNT.RIGHT_SIDE_GROUPS.map(normalize));

  const { grossProfit, grossLoss } = getGrossResultFromTradingAccount({
    groupedAccounts,
    allEntryQuantities,
    cashSaleQuantities,
    stockValuations,
    openingQuantities,
    closingQuantities,
    leftSet: tradingLeftSet,
    rightSet: tradingRightSet
  });

  // Step 3: Map Profit & Loss flat groups
  const profitLossLeftSet = new Set(PROFIT_LOSS.LEFT_SIDE_GROUPS.map(normalize));
  const profitLossRightSet = new Set(PROFIT_LOSS.RIGHT_SIDE_GROUPS.map(normalize));

  const debitGroups = mapFlatGroupsGeneric(groupedAccounts, profitLossLeftSet, {}, PROFIT_LOSS);
  const creditGroups = mapFlatGroupsGeneric(groupedAccounts, profitLossRightSet, {}, PROFIT_LOSS);

  // Step 4: Inject Gross Profit or Loss into respective side
  if (grossProfit) {
    creditGroups.unshift({
      group: 'Gross Profit',
      groupMode: 'flat',
      items: [{ label: 'Gross Profit', amount: grossProfit, source: 'derived' }],
      total: grossProfit
    });
  }

  if (grossLoss) {
    debitGroups.unshift({
      group: 'Gross Loss',
      groupMode: 'flat',
      items: [{ label: 'Gross Loss', amount: grossLoss, source: 'derived' }],
      total: grossLoss
    });
  }

  // Step 5: Sort groups based on config order
  const sortedDebitGroups = sortGroups(debitGroups, PROFIT_LOSS.LEFT_SIDE_GROUPS);
  const sortedCreditGroups = sortGroups(creditGroups, PROFIT_LOSS.RIGHT_SIDE_GROUPS);

  // Step 6: Compute original totals
  const originalDebitTotal = sortedDebitGroups.reduce((sum, g) => sum + g.total, 0);
  const creditTotalAmount = sortedCreditGroups.reduce((sum, g) => sum + g.total, 0);
  

  // Step 7: Compute Net Profit or Net Loss (summary only)
  const netAmount = creditTotalAmount - originalDebitTotal;
  const netProfit = netAmount > 0 ? netAmount : null;
  const netLoss = netAmount < 0 ? Math.abs(netAmount) : null;

  // Step 8: Force debit total to match credit total for visual balance
  const debitTotalAmount = creditTotalAmount;

  // Step 9: Quantity is not used in P&L
  const debitTotalQuantity = 0;
  const creditTotalQuantity = 0;

  // Step 10: Return final report structure
  return {
    debitGroups: sortedDebitGroups,
    creditGroups: sortedCreditGroups,
    netProfit,
    netLoss,
    debitTotalAmount,
    creditTotalAmount,
    debitTotalQuantity,
    creditTotalQuantity
  };
};
