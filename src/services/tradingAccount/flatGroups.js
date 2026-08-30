const { normalize } = require('./groupUtils');

exports.mapFlatGroupsGeneric = (
  groups,
  sideSet,
  structuredGroupMap,
  config,
  dynamicGroups = null
) => {
  const safeDynamicGroups = Array.isArray(dynamicGroups) ? dynamicGroups : [];

  const filterGroupSet = new Set((config.FILTER_GROUPS || []).map(normalize));
  const structuredGroupList = config.STRUCTURED_GROUPS || [];

  return groups
    .map(g => {
      const groupKey = g.groupName;
      const normalizedKey = normalize(groupKey);

      if (filterGroupSet.has(normalizedKey)) return null;

      const isStructured = structuredGroupList.includes(groupKey);

      // Normal account items
      const items = g.accounts
        .filter(acc => {
          if (!sideSet.has(normalizedKey)) return false;
          if (!isStructured) return true;

          const structuredItems = structuredGroupMap[groupKey]?.items || [];
          return !structuredItems.some(i => i.label === acc.accountName);
        })
        .map(acc => {
          const amount = acc.debit && acc.debit > 0 ? acc.debit : acc.credit ?? 0;
          const type = acc.credit > 0; // true if credit, false if debit
          return {
            label: acc.accountName,
            amount,
            source: 'account',
            type
          };
        });

      // Dynamic children as group totals using sumAccounts
      const dynChildren = safeDynamicGroups
        .filter(d => sideSet.has(normalize(d.parent))) // ✅ parent must be in this side
        .filter(d => d.parent === groupKey)
        .flatMap(d =>
          d.children.map(childName => {
            const childGroup = groups.find(
              gr => normalize(gr.groupName) === normalize(childName)
            );
            let amount = 0;
            let type = false;
            if (childGroup) {
              const { debitSum, creditSum, net } = sumAccounts(childGroup.accounts);
              amount = net;
              type = creditSum > debitSum; // true if credit side dominates
            }
            return {
              label: childName,
              amount,
              source: 'dynamic-group',
              type
            };
          })
        );

      const allItems = [...items, ...dynChildren];

      if (allItems.length === 0) return null;

      return {
        group: groupKey,
        groupMode: isStructured ? 'structured' : 'flat',
        items: allItems,
        total: allItems.reduce(
          (sum, i) => sum + parseFloat(i.amount || 0),
          0
        )
      };
    })
    .filter(Boolean);
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
  return { debitSum, creditSum, net: Math.abs(debitSum - creditSum) };
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
      parentLabel: label,   // 🔹 track parent
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
        parentLabel: label,
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

function pushMixed(transformed, label, accounts, subGroups, groupMap, hierarchyTree) {
  // Roll up all subgroup accounts recursively
  subGroups.forEach(child => {
    const { debitSum: d, creditSum: c } = rollUpAccounts(child, groupMap, hierarchyTree);
    const amount = Math.abs(d - c);

    transformed.push({
      label: child,
      groupMode: 'flat',
      innerAmount: 0,
      outerAmount: amount
    });
  });
  pushFlat(transformed, label, accounts);
}

exports.mapStructuredGroupsBySide = (groupedAccounts, sideSet, config, hierarchyTree) => {
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
      const { net } = sumAccounts(accounts);
      transformed.push({
        label: groupName,
        group: 'flat',
        innerAmount: 0,
        outerAmount: net
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
      pushMixed(transformed, groupName, accounts, subGroups, groupMap, hierarchyTree);
    }
  });

  return filterEmptyGroupsFlat(transformed);
};

function rollUpAccounts(label, groupMap, hierarchyTree) {
  let debitSum = 0;
  let creditSum = 0;

  // Recursive walker
  function walk(node) {
    if (!node) return;

    // Add this group's accounts
    const group = groupMap.get(normalize(node.name));
    if (group?.accounts) {
      group.accounts.forEach(acc => {
        debitSum += acc.debit || 0;
        creditSum += acc.credit || 0;
      });
    }

    // Recurse into children
    (node.children || []).forEach(child => walk(child));
  }

  // Find the node in the hierarchy tree
  function findNode(name, nodes) {
    for (const node of nodes) {
      if (node.name === name) return node;
      const result = findNode(name, node.children || []);
      if (result) return result;
    }
    return null;
  }

  const rootNode = findNode(label, hierarchyTree);
  if (rootNode) walk(rootNode);

  return { debitSum, creditSum };
}

function filterEmptyGroupsFlat(transformed) {
  // Build a map of parent -> child accounts
  const accountsByParent = new Map();
  transformed.forEach(item => {
    if (item.parentLabel) {
      if (!accountsByParent.has(item.parentLabel)) {
        accountsByParent.set(item.parentLabel, []);
      }
      accountsByParent.get(item.parentLabel).push(item);
    }
  });

  return transformed.filter(item => {
    const hasAmount = (item.innerAmount && item.innerAmount !== 0) ||
      (item.outerAmount && item.outerAmount !== 0);

    if (item.parentLabel) {
      // Account row: keep only if it has non-zero amounts
      return hasAmount;
    } else {
      // Group row: keep if it has non-zero amounts OR if any child has non-zero amounts
      const children = accountsByParent.get(item.label) || [];
      const childHasAmount = children.some(c =>
        (c.innerAmount && c.innerAmount !== 0) || (c.outerAmount && c.outerAmount !== 0)
      );
      return hasAmount || childHasAmount;
    }
  });
}

exports.buildGroupAccountMap = (groupedAccounts, config) => {
  const {
    STRUCTURED_GROUPS = [],
    RELATIONSHIP_GROUPS = [],
    LEFT_SIDE_GROUPS = [],
    RIGHT_SIDE_GROUPS = []
  } = config;

  const groupMap = new Map(groupedAccounts.map(g => [normalize(g.groupName), g.accounts]));
  const result = new Map();

  // authoritative list of groups = left + right
  const allGroups = [...LEFT_SIDE_GROUPS, ...RIGHT_SIDE_GROUPS];

  allGroups.forEach(groupName => {
    const struct = STRUCTURED_GROUPS.find(s => normalize(s.group) === normalize(groupName));
    let accounts = [];

    if (struct) {
      if (struct.displayMode === 'flat') {
        accounts = groupMap.get(normalize(groupName)) || [];
      } else if (struct.displayMode === 'nested') {
        const rel = RELATIONSHIP_GROUPS.find(r => normalize(r.parent) === normalize(groupName));
        const children = rel?.children || [];
        accounts = children.flatMap(child => groupMap.get(normalize(child)) || []);
      } else if (struct.displayMode === 'mixed') {
        const rel = RELATIONSHIP_GROUPS.find(r => normalize(r.parent) === normalize(groupName));
        const children = rel?.children || [];
        accounts = [
          ...(groupMap.get(normalize(groupName)) || []),
          ...children.flatMap(child => groupMap.get(normalize(child)) || [])
        ];
      }
    } else {
      // not structured → just map direct accounts
      accounts = groupMap.get(normalize(groupName)) || [];
    }

    // ✅ Only keep accounts with valid account_id
    accounts = accounts.filter(acc => acc.account_id);

    if (accounts.length > 0) {
      result.set(groupName, accounts);
    }
  });

  return result;
};

