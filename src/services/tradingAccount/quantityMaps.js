exports.classifyQuantities = (allEntryQuantities) => {
  const purchase = [], sale = [], purchaseReturn = [], saleReturn = [];

  allEntryQuantities.forEach(row => {
    switch (row.type) {
      case 1: purchase.push(row); break;
      case 2: sale.push(row); break;
      case 3: purchaseReturn.push(row); break;
      case 4: saleReturn.push(row); break;
    }
  });

  return { purchase, sale, purchaseReturn, saleReturn };
};

exports.buildItemAccountMaps = ({ purchaseReturn, saleReturn }) => ({
  itemToPurchaseReturnAccountMap: new Map(purchaseReturn.map(row => [row.item_id, row.category_account_id])),
  itemToSaleReturnAccountMap: new Map(saleReturn.map(row => [row.item_id, row.category_account_id]))
});
