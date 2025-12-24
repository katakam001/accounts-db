const { normalize } = require('../tradingAccount/groupUtils');
const { mapStructuredGroupsBySide } = require('../tradingAccount/flatGroups');
const { injectDynamicChildren } = require('../dynamicGroups.service');


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

