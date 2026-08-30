const { PROFIT_LOSS } = require('../../constants/groupMeta');
const { normalize } = require('../tradingAccount/groupUtils');
const { mapFlatGroupsGeneric } = require('../tradingAccount/flatGroups');

exports.buildProfitAndLossReport = ({ groupedAccounts, grossProfit, grossLoss, dynamicGroups }) => {

  const profitLossLeftSet = new Set(PROFIT_LOSS.LEFT_SIDE_GROUPS.map(normalize));
  const profitLossRightSet = new Set(PROFIT_LOSS.RIGHT_SIDE_GROUPS.map(normalize));

  let debitGroups = mapFlatGroupsGeneric(groupedAccounts, profitLossLeftSet, {}, PROFIT_LOSS, dynamicGroups);
  let creditGroups = mapFlatGroupsGeneric(groupedAccounts, profitLossRightSet, {}, PROFIT_LOSS, dynamicGroups);

  if (grossProfit) {
    creditGroups.unshift({
      group: 'Gross Profit',
      groupMode: 'flat',
      items: [{ label: 'Gross Profit', amount: grossProfit, source: 'derived', type: true }],
      total: grossProfit
    });
  }

  if (grossLoss) {
    debitGroups.unshift({
      group: 'Gross Loss',
      groupMode: 'flat',
      items: [{ label: 'Gross Loss', amount: grossLoss, source: 'derived', type: false }],
      total: grossLoss
    });
  }

  ({ debitGroups, creditGroups } = normalizeGroupsByTypeWithMapping(debitGroups, creditGroups, PROFIT_LOSS));

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

function normalizeGroupsByTypeWithMapping(debitGroups, creditGroups, config) {
  const { CROSS_SIDE_MAPPING = {} } = config;

  const newDebitGroups = [...debitGroups];
  const newCreditGroups = [...creditGroups];

  // Process debitGroups
  for (const g of debitGroups) {
    const debitItems = [];
    const creditItemsToRoute = [];

    for (const item of g.items) {
      if (item.type === true) {
        creditItemsToRoute.push(item);
      } else {
        debitItems.push({ ...item, type: false });
      }
    }

    g.items = debitItems;
    g.total = debitItems.reduce((s, i) => s + i.amount, 0);

    if (creditItemsToRoute.length) {
      const targetGroupName = CROSS_SIDE_MAPPING.LEFT_TO_RIGHT?.[g.group];
      if (targetGroupName) {
        let target = newCreditGroups.find(x => x.group === targetGroupName);
        if (!target) {
          target = { group: targetGroupName, groupMode: 'flat', items: [], total: 0 };
          newCreditGroups.push(target);
        }
        target.items.push(...creditItemsToRoute.map(i => ({ ...i, type: true })));
        target.total = target.items.reduce((s, i) => s + i.amount, 0);
      } else {
        // No mapping defined → keep items in original group
        g.items.push(...creditItemsToRoute.map(i => ({ ...i, type: true })));
        g.total = g.items.reduce((s, i) => s + i.amount, 0);
      }
    }
  }

  // Process creditGroups
  for (const g of creditGroups) {
    const creditItems = [];
    const debitItemsToRoute = [];

    for (const item of g.items) {
      if (item.type === false) {
        debitItemsToRoute.push(item);
      } else {
        creditItems.push({ ...item, type: true });
      }
    }

    g.items = creditItems;
    g.total = creditItems.reduce((s, i) => s + i.amount, 0);

    if (debitItemsToRoute.length) {
      const targetGroupName = CROSS_SIDE_MAPPING.RIGHT_TO_LEFT?.[g.group];
      if (targetGroupName) {
        let target = newDebitGroups.find(x => x.group === targetGroupName);
        if (!target) {
          target = { group: targetGroupName, groupMode: 'flat', items: [], total: 0 };
          newDebitGroups.push(target);
        }
        target.items.push(...debitItemsToRoute.map(i => ({ ...i, type: false })));
        target.total = target.items.reduce((s, i) => s + i.amount, 0);
      } else {
        // No mapping defined → keep items in original group
        g.items.push(...debitItemsToRoute.map(i => ({ ...i, type: false })));
        g.total = g.items.reduce((s, i) => s + i.amount, 0);
      }
    }
  }

  return { debitGroups: newDebitGroups, creditGroups: newCreditGroups };
}
