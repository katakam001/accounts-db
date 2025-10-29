const { PROFIT_LOSS } = require('../../constants/groupMeta');
const { normalize } = require('../tradingAccount/groupUtils');
const { mapFlatGroupsGeneric } = require('../tradingAccount/flatGroups');

exports.buildProfitAndLossReport = ({ groupedAccounts, grossProfit, grossLoss }) => {
  const profitLossLeftSet = new Set(PROFIT_LOSS.LEFT_SIDE_GROUPS.map(normalize));
  const profitLossRightSet = new Set(PROFIT_LOSS.RIGHT_SIDE_GROUPS.map(normalize));

  const debitGroups = mapFlatGroupsGeneric(groupedAccounts, profitLossLeftSet, {}, PROFIT_LOSS);
  const creditGroups = mapFlatGroupsGeneric(groupedAccounts, profitLossRightSet, {}, PROFIT_LOSS);

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

  const filteredDebitGroups = debitGroups.map(sanitizeGroupItems);
  const filteredCreditGroups = creditGroups.map(sanitizeGroupItems);

  const sortedDebitGroups = sortGroups(filteredDebitGroups, PROFIT_LOSS.LEFT_SIDE_GROUPS);
  const sortedCreditGroups = sortGroups(filteredCreditGroups, PROFIT_LOSS.RIGHT_SIDE_GROUPS);

  const originalDebitTotal = sortedDebitGroups.reduce((sum, g) => sum + g.total, 0);
  const creditTotalAmount = sortedCreditGroups.reduce((sum, g) => sum + g.total, 0);

  const netAmount = creditTotalAmount - originalDebitTotal;
  const netProfit = netAmount > 0 ? netAmount : null;
  const netLoss = netAmount < 0 ? Math.abs(netAmount) : null;

  const debitTotalAmount = creditTotalAmount;
  const debitTotalQuantity = 0;
  const creditTotalQuantity = 0;

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

function sortGroups(groups, order) {
  return order.map(name => groups.find(g => g.group === name)).filter(Boolean);
}

const sanitizeGroupItems = group => {
  const filteredItems = group.items.filter(i => {
    const amount = parseFloat(i.amount || '0');
    const quantity = parseFloat(i.quantity || '0');
    return amount !== 0 || quantity !== 0;
  });

  const total = filteredItems.reduce((sum, i) => sum + parseFloat(i.amount || '0'), 0);

  return { ...group, items: filteredItems, total };
};
