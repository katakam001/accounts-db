const { TRADING_ACCOUNT } = require('../../constants/groupMeta');

exports.normalize = name => name.trim().toLowerCase();

exports.extractRelatedGroups = (groupedAccounts) => {
  const normalize = exports.normalize;
  const relatedGroupSet = new Set(TRADING_ACCOUNT.RELATED_GROUPS.map(normalize));
  const relatedGroupMap = {};

  groupedAccounts.forEach(g => {
    const key = normalize(g.groupName);
    if (relatedGroupSet.has(key)) {
      relatedGroupMap[key] = g.accounts;
    }
  });

  return relatedGroupMap;
};
