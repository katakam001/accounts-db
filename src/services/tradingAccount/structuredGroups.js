const { TRADING_ACCOUNT } = require('../../constants/groupMeta');

exports.buildStructuredGroupMap = () => {
  return TRADING_ACCOUNT.STRUCTURED_GROUPS.reduce((acc, groupName) => {
    acc[groupName] = {
      group: groupName,
      groupMode: 'structured',
      items: [],
      total: 0
    };
    return acc;
  }, {});
};

exports.populateStockGroups = (structuredGroupMap, stockValuations, openingQuantities, closingQuantities) => {
  structuredGroupMap['Opening Stock'].items = stockValuations.map(row => ({
    label: row.item_name,
    amount: row.opening_stock_valuation,
    quantity: openingQuantities.find(q => q.item_id === row.item_id)?.quantity || 0,
    source: 'item'
  }));

  structuredGroupMap['Opening Stock'].total = structuredGroupMap['Opening Stock'].items.reduce(
    (sum, i) => sum + parseFloat(i.amount || 0), 0
  );

  structuredGroupMap['Closing Stock'].items = stockValuations.map(row => ({
    label: row.item_name,
    amount: row.closing_stock_valuation,
    quantity: closingQuantities.find(q => q.item_id === row.item_id)?.quantity || 0,
    source: 'item'
  }));

  structuredGroupMap['Closing Stock'].total = structuredGroupMap['Closing Stock'].items.reduce(
    (sum, i) => sum + parseFloat(i.amount || 0), 0
  );
};

exports.populatePurchaseAndSaleGroups = ({
  structuredGroupMap,
  purchaseAccounts,
  saleAccounts,
  purchaseQuantities,
  saleQuantities,
  purchaseReturnQuantities,
  saleReturnQuantities,
  cashSaleQuantities,
  itemToPurchaseReturnAccountMap,
  itemToSaleReturnAccountMap,
  purchaseReturnAccounts,
  saleReturnAccounts
}) => {
  // Purchase Account
  structuredGroupMap['Purchase Account'].items = purchaseAccounts.map(acc => {
    const purchaseQtyRow = purchaseQuantities.find(q => q.category_account_id === acc.account_id);
    const itemId = purchaseQtyRow?.item_id;
    const purchaseQty = parseFloat(purchaseQtyRow?.total_quantity || 0);

    const returnQtyRow = itemId
      ? purchaseReturnQuantities.find(r => r.item_id === itemId)
      : null;
    const returnQty = parseFloat(returnQtyRow?.total_quantity || 0);

    const returnAccId = itemToPurchaseReturnAccountMap.get(itemId);
    const returnAcc = returnAccId
      ? purchaseReturnAccounts.find(r => r.account_id === returnAccId)
      : null;
    const returnAmount = returnAcc
      ? (returnAcc.debit && returnAcc.debit > 0 ? returnAcc.debit : returnAcc.credit ?? 0)
      : 0;

    const amount = acc.debit && acc.debit > 0 ? acc.debit : acc.credit ?? 0;
    const netAmount = amount - returnAmount;

    const label = acc.accountName.replace(/^PURCHASE OF\s*/i, '');

    return {
      label,
      item_id: itemId,
      amount: netAmount,
      quantity: purchaseQty - returnQty,
      source: 'item'
    };
  });

  structuredGroupMap['Purchase Account'].total = structuredGroupMap['Purchase Account'].items.reduce(
    (sum, i) => sum + parseFloat(i.amount || 0), 0
  );

  // Sale Account
  structuredGroupMap['Sale Account'].items = saleAccounts.map(acc => {
    const saleQtyRow = saleQuantities.find(q => q.category_account_id === acc.account_id)
      || cashSaleQuantities.find(q => q.category_account_id === acc.account_id);
    const itemId = saleQtyRow?.item_id;
    const saleQty = parseFloat(saleQtyRow?.total_quantity || 0);

    const returnQtyRow = itemId
      ? saleReturnQuantities.find(r => r.item_id === itemId)
      : null;
    const returnQty = parseFloat(returnQtyRow?.total_quantity || 0);

    const returnAccId = itemToSaleReturnAccountMap.get(itemId);
    const returnAcc = returnAccId
      ? saleReturnAccounts.find(r => r.account_id === returnAccId)
      : null;
    const returnAmount = returnAcc
      ? (returnAcc.debit && returnAcc.debit > 0 ? returnAcc.debit : returnAcc.credit ?? 0)
      : 0;

    const amount = acc.debit && acc.debit > 0 ? acc.debit : acc.credit ?? 0;
    const netAmount = amount - returnAmount;

    const label = acc.accountName.replace(/^SALE OF\s*/i, '');

    return {
      label,
      item_id: itemId,
      amount: netAmount,
      quantity: saleQty - returnQty,
      source: 'item'
    };
  });

  structuredGroupMap['Sale Account'].total = structuredGroupMap['Sale Account'].items.reduce(
    (sum, i) => sum + parseFloat(i.amount || 0), 0
  );
};
