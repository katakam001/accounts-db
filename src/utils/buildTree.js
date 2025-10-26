exports.buildTree = (
  data,
  accounts,
  openingStockItems = [],
  closingStockItems = [],
  parentId = null
) => {
  if (!data || !accounts) return [];

  return data
    .filter(item => item.parent_id === parentId)
    .map(item => {
      const children = exports.buildTree(
        data,
        accounts,
        openingStockItems,
        closingStockItems,
        item.id
      );

      const groupAccounts = accounts
        .filter(account => account.group_id === item.group_id)
        .map(account => ({
          id: account.account_id,
          name: account.account_name,
          source: 'account'
        }));

      let itemChildren = [];

      if (item.Group.name === 'Opening Stock') {
        itemChildren = openingStockItems.map(i => ({
          id: i.item_id,
          name: i.item_name,
          source: 'item'
        }));
      }

      if (item.Group.name === 'Closing Stock') {
        itemChildren = closingStockItems.map(i => ({
          id: i.item_id,
          name: i.item_name,
          source: 'item'
        }));
      }

      return {
        id: item.id,
        parent_id: item.parent_id,
        name: item.Group.name,
        children: [...children, ...groupAccounts, ...itemChildren]
      };
    });
};
