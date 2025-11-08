const { TRADING_ACCOUNT, BALANCE_SHEET } = require('../constants/groupMeta');
const { normalize } = require('./tradingAccount/groupUtils');
const { getTradingAccountData } = require('./tradingAccount/dataFetcher');
const { buildTradingAccountReport } = require('./tradingAccount.service');
const { buildProfitAndLossReport } = require('./profitAndLoss/profitLossBuilder');
const { mapBalanceSheetGroups } = require('./balanceSheet/balanceSheetBuilder');

/**
 * Builds the full Balance Sheet report with net result injected into Capital Account.
 */
exports.calculateBalanceSheetReport = async ({ db, userId, financialYear, fromDate, toDate }) => {
  // Step 1: Fetch all trial balance and quantity data
  const {
    groupedAccounts,
    allEntryQuantities,
    cashSaleQuantities,
    stockValuations,
    openingQuantities,
    closingQuantities
  } = await getTradingAccountData({ db, userId, financialYear, fromDate, toDate });

  // Step 2: Compute gross result from Trading Account
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

  // Step 3: Compute net result from Profit & Loss
  const { netProfit, netLoss } = buildProfitAndLossReport({
    groupedAccounts,
    grossProfit,
    grossLoss
  });

  // Step 4: Inject net result into Capital Account group
  const capitalKey = normalize('Capital Account');
  const capitalGroup = groupedAccounts.find(g => normalize(g.groupName) === capitalKey);

  if (capitalGroup) {
    const amount = netProfit || -netLoss || 0;
    capitalGroup.accounts.push({
      accountName: netProfit ? 'Net Profit' : 'Net Loss',
      debit: amount < 0 ? Math.abs(amount) : 0,
      credit: amount > 0 ? amount : 0
    });
  }

  // Step 5: Build balance sheet using enriched groupedAccounts
  const config = BALANCE_SHEET;
  const { leftGroups, rightGroups } = await mapBalanceSheetGroups(groupedAccounts, config, userId, financialYear);

  return {
    left: leftGroups,
    right: rightGroups
  };
};