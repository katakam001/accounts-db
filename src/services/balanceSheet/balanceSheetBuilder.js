const { normalize } = require('../tradingAccount/groupUtils');
const { getGroupHierarchyTree } = require('../groupMapping.service'); // your lightweight tree service
const { mapStructuredGroupsBySide } = require('../tradingAccount/flatGroups');

async function injectDynamicChildren(userId, financialYear, relationshipGroups) {
    const fullTreeList = await getGroupHierarchyTree(userId, financialYear);

    const findChildren = (parentName, nodes) => {
        for (const node of nodes) {
            if (node.name === parentName) {
                return node.children?.map(c => c.name) || [];
            }
            const result = findChildren(parentName, node.children || []);
            if (result.length) return result;
        }
        return [];
    };

    return relationshipGroups
        .filter(rel => rel.source === 'dynamic')
        .map(rel => ({
            ...rel,
            children: findChildren(rel.parent, fullTreeList)
        }));
}

exports.mapBalanceSheetGroups = async (groupedAccounts, config, userId, financialYear) => {

    const dynamicGroups = await injectDynamicChildren(userId, financialYear, config.RELATIONSHIP_GROUPS);

    const staticGroups = config.RELATIONSHIP_GROUPS.filter(rel => rel.source !== 'dynamic');

    const enrichedConfig = {
        ...config,
        RELATIONSHIP_GROUPS: [...staticGroups, ...dynamicGroups]
    };

    const leftSet = new Set(config.LEFT_SIDE_GROUPS.map(normalize));
    const rightSet = new Set(config.RIGHT_SIDE_GROUPS.map(normalize));

    const leftGroups = mapStructuredGroupsBySide(groupedAccounts, leftSet, enrichedConfig);
    const rightGroups = mapStructuredGroupsBySide(groupedAccounts, rightSet, enrichedConfig);

    return { leftGroups, rightGroups };
};

