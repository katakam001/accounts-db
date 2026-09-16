const { getGroupHierarchyTree } = require('./groupMapping.service');

exports.injectDynamicChildren = async (userId, financialYear, relationshipGroups) => {

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
};