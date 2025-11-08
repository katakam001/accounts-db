const { normalize } = require('./groupUtils');

exports.mapFlatGroupsGeneric = (groups, sideSet, structuredGroupMap, config) => {
  const filterGroupSet = new Set((config.FILTER_GROUPS || []).map(normalize));
  const structuredGroupList = config.STRUCTURED_GROUPS || [];

  return groups.map(g => {
    const groupKey = g.groupName;
    const normalizedKey = normalize(groupKey);

    if (filterGroupSet.has(normalizedKey)) return null;

    const isStructured = structuredGroupList.includes(groupKey);

    const items = g.accounts
      .filter(acc => {
        if (!sideSet.has(normalizedKey)) return false;
        if (!isStructured) return true;

        const structuredItems = structuredGroupMap[groupKey]?.items || [];
        return !structuredItems.some(i => i.label === acc.accountName);
      })
      .map(acc => ({
        label: acc.accountName,
        amount: acc.debit && acc.debit > 0 ? acc.debit : acc.credit ?? 0,
        source: 'account'
      }));

    if (items.length === 0) return null;

    return {
      group: groupKey,
      groupMode: isStructured ? 'structured' : 'flat',
      items,
      total: items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0)
    };
  }).filter(Boolean);
};

function createNormalizedMaps(groupedAccounts, structuredGroups) {
  const normalizeMap = (list, key) =>
    new Map(list.map(item => [normalize(item[key]), item]));

  return {
    structuredMap: normalizeMap(structuredGroups, 'group'),
    groupMap: normalizeMap(groupedAccounts, 'groupName')
  };
}

function sumAccounts(accounts) {
  const debitSum = accounts.reduce((sum, a) => sum + (a.debit || 0), 0);
  const creditSum = accounts.reduce((sum, a) => sum + (a.credit || 0), 0);
  return Math.abs(debitSum - creditSum);
}

function pushFlat(transformed, label, accounts) {
  let debitSum = 0;
  let creditSum = 0;

  transformed.push({ label, groupMode: 'flat', innerAmount: 0, outerAmount: 0 });

  accounts.forEach((acc, index) => {
    const debit = acc.debit || 0;
    const credit = acc.credit || 0;

    debitSum += debit;
    creditSum += credit;

    const amount = debit > 0 ? debit : credit;

    transformed.push({
      label: acc.accountName,
      groupMode: 'flat',
      innerAmount: amount,
      outerAmount: 0
    });
  });

  const total = Math.abs(debitSum - creditSum);
  if (accounts.length > 0) {
    transformed[transformed.length - 1].outerAmount = total;
  }
}

function pushNested(transformed, label, children, groupMap) {
  let debitSum = 0;
  let creditSum = 0;
  let lastAccountIndex = -1;

  transformed.push({ label, groupMode: 'nested', innerAmount: 0, outerAmount: 0 });

  children.forEach(child => {
    const childAccounts = groupMap.get(normalize(child))?.accounts || [];

    transformed.push({ label: child, groupMode: 'flat', innerAmount: 0, outerAmount: 0 });

    childAccounts.forEach(acc => {
      const debit = acc.debit || 0;
      const credit = acc.credit || 0;

      debitSum += debit;
      creditSum += credit;

      const amount = debit > 0 ? debit : credit;

      transformed.push({
        label: acc.accountName,
        groupMode: 'flat',
        innerAmount: amount,
        outerAmount: 0
      });

      lastAccountIndex = transformed.length - 1;
    });
  });

  const total = Math.abs(debitSum - creditSum);
  if (lastAccountIndex >= 0) {
    transformed[lastAccountIndex].outerAmount = total;
  }
}

function pushMixed(transformed, label, accounts, subGroups, groupMap) {

  subGroups.forEach(child => {
    const childAccounts = groupMap.get(normalize(child))?.accounts || [];
    const amount = sumAccounts(childAccounts);

    transformed.push({
      label: child,
      groupMode: 'flat',
      innerAmount: 0,
      outerAmount: amount
    });
  });
  pushFlat(transformed, label, accounts);
}

exports.mapStructuredGroupsBySide = (groupedAccounts, sideSet, config) => {
  const {
    STRUCTURED_GROUPS = [],
    RELATIONSHIP_GROUPS = []
  } = config;

  const { structuredMap, groupMap } = createNormalizedMaps(groupedAccounts, STRUCTURED_GROUPS);
  const transformed = [];

  sideSet.forEach(normKey => {
    const structured = structuredMap.get(normKey);
    const groupName = structured?.group ||
      groupedAccounts.find(g => normalize(g.groupName) === normKey)?.groupName ||
      normKey;

    const accounts = groupMap.get(normKey)?.accounts || [];

    if (!structured) {
      transformed.push({
        label: groupName,
        group: 'flat',
        innerAmount: 0,
        outerAmount: sumAccounts(accounts)
      });
      return;
    }

    const { displayMode, subGroups = [] } = structured;

    if (displayMode === 'flat') {
      pushFlat(transformed, groupName, accounts);
    } else if (displayMode === 'nested') {
      const rel = RELATIONSHIP_GROUPS.find(r => normalize(r.parent) === normKey);
      const children = rel?.children || [];
      pushNested(transformed, groupName, children, groupMap);
    } else if (displayMode === 'mixed') {
      pushMixed(transformed, groupName, accounts, subGroups, groupMap);
    }
  });

  return transformed;
};
