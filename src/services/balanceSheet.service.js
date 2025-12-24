const { TRADING_ACCOUNT,PROFIT_LOSS, BALANCE_SHEET } = require('../constants/groupMeta');
const { normalize } = require('./tradingAccount/groupUtils');
const { getTradingAccountData } = require('./tradingAccount/dataFetcher');
const { buildTradingAccountReport } = require('./tradingAccount.service');
const { buildProfitAndLossReport } = require('./profitAndLoss/profitLossBuilder');
const { mapBalanceSheetGroups } = require('./balanceSheet/balanceSheetBuilder');
const { injectDynamicChildren } = require('./dynamicGroups.service');

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

    const dynamicGroups = await injectDynamicChildren(userId, financialYear, PROFIT_LOSS.RELATIONSHIP_GROUPS);

  // Step 3: Compute net result from Profit & Loss
  const { netProfit, netLoss } = buildProfitAndLossReport({
    groupedAccounts,
    grossProfit,
    grossLoss,
    dynamicGroups
  });

  // Step 4: Adjust net result using Profit & Loss A/C group
  const capitalKey = normalize('Capital Account');
  const profitLossKey = normalize('Profit & Loss A/C');

  const capitalGroup = groupedAccounts.find(g => normalize(g.groupName) === capitalKey);
  const profitLossGroup = groupedAccounts.find(g => normalize(g.groupName) === profitLossKey);

  let netAmount = netProfit || -netLoss || 0;

  if (profitLossGroup) {
    const debitResidual = profitLossGroup.accounts.reduce((sum, acc) => sum + (acc.debit || 0), 0);
    const creditResidual = profitLossGroup.accounts.reduce((sum, acc) => sum + (acc.credit || 0), 0);

    if (netProfit) {
      netAmount -= debitResidual;
    } else if (netLoss) {
      netAmount += creditResidual;
    }
  }

  if (capitalGroup) {
    capitalGroup.accounts.push({
      accountName: netProfit ? 'Net Profit' : 'Net Loss',
      debit: netAmount < 0 ? Math.abs(netAmount) : 0,
      credit: netAmount > 0 ? netAmount : 0
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