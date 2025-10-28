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
