const { TRADING_ACCOUNT } = require('../../constants/groupMeta');
const { classifyQuantities, buildItemAccountMaps } = require('./quantityMaps');
const { extractRelatedGroups, normalize } = require('./groupUtils');
const { buildStructuredGroupMap, populateStockGroups, populatePurchaseAndSaleGroups } = require('./structuredGroups');
const { mapFlatGroupsGeneric } = require('./flatGroups');

function sumQuantities(groupName, structuredGroupMap) {
    const items = structuredGroupMap[groupName]?.items || [];
    return items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
}

function sortGroups(groups, order) {
    return order.map(name => groups.find(g => g.group === name)).filter(Boolean);
}

const sanitizeGroupItems = group => {
  const filteredItems = group.items.filter(i => {
    const amount = parseFloat(i.amount || '0');
    const quantity = parseFloat(i.quantity || '0');
    return amount !== 0 || quantity !== 0;
  });

  const total = filteredItems.reduce((sum, i) => sum + parseFloat(i.amount || '0'), 0);

  return { ...group, items: filteredItems, total };
};


exports.calculateTradingAccountData = ({
    groupedAccounts,
    allEntryQuantities,
    cashSaleQuantities,
    stockValuations,
    openingQuantities,
    closingQuantities,
    leftSet,
    rightSet
}) => {
    const { purchase, sale, purchaseReturn, saleReturn } = classifyQuantities(allEntryQuantities);
    const {
        itemToPurchaseReturnAccountMap,
        itemToSaleReturnAccountMap
    } = buildItemAccountMaps({ purchaseReturn, saleReturn });

    const relatedGroupMap = extractRelatedGroups(groupedAccounts);
    const structuredGroupMap = buildStructuredGroupMap();

    populateStockGroups(structuredGroupMap, stockValuations, openingQuantities, closingQuantities);

    populatePurchaseAndSaleGroups({
        structuredGroupMap,
        purchaseAccounts: relatedGroupMap['purchase account'] || [],
        saleAccounts: relatedGroupMap['sale account'] || [],
        purchaseQuantities: purchase,
        saleQuantities: sale,
        purchaseReturnQuantities: purchaseReturn,
        saleReturnQuantities: saleReturn,
        cashSaleQuantities,
        itemToPurchaseReturnAccountMap,
        itemToSaleReturnAccountMap,
        purchaseReturnAccounts: relatedGroupMap['purchase return account'] || [],
        saleReturnAccounts: relatedGroupMap['sale return account'] || []
    });

    const debitNoteTotal = (relatedGroupMap['debit note account'] || []).reduce((sum, acc) => {
        const amount = acc.debit && acc.debit > 0 ? acc.debit : acc.credit ?? 0;
        return sum + parseFloat(amount);
    }, 0);

    const creditNoteTotal = (relatedGroupMap['credit note account'] || []).reduce((sum, acc) => {
        const amount = acc.credit && acc.credit > 0 ? acc.credit : acc.debit ?? 0;
        return sum + parseFloat(amount);
    }, 0);

    const debitNoteGroup = {
        group: 'Debit Note Account',
        groupMode: 'flat',
        items: [{ label: 'Debit Note Account', amount: debitNoteTotal, source: 'group' }],
        total: debitNoteTotal
    };

    const creditNoteGroup = {
        group: 'Credit Note Account',
        groupMode: 'flat',
        items: [{ label: 'Credit Note Account', amount: creditNoteTotal, source: 'group' }],
        total: creditNoteTotal
    };

    const flatGroupsLeft = mapFlatGroupsGeneric(groupedAccounts, leftSet, structuredGroupMap, TRADING_ACCOUNT);
    const flatGroupsRight = mapFlatGroupsGeneric(groupedAccounts, rightSet, structuredGroupMap, TRADING_ACCOUNT);

    return {
        structuredGroupMap,
        debitNoteGroup,
        creditNoteGroup,
        flatGroupsLeft,
        flatGroupsRight
    };
};

exports.finalizeTradingAccountGroups = ({
    structuredGroupMap,
    flatDebitGroups,
    flatCreditGroups,
    debitNoteGroup,
    creditNoteGroup,
    leftSet,
    rightSet
}) => {
    const openingStockFlatIndex = flatDebitGroups.findIndex(
        g => normalize(g.group) === 'opening stock'
    );

    if (openingStockFlatIndex !== -1) {
        const fallbackGroup = flatDebitGroups[openingStockFlatIndex];
        fallbackGroup.items.forEach(acc => {
            structuredGroupMap['Opening Stock'].items.push({
                label: acc.label,
                amount: acc.amount,
                quantity: undefined,
                source: 'account'
            });
        });
        structuredGroupMap['Opening Stock'].total = structuredGroupMap['Opening Stock'].items.reduce(
            (sum, i) => sum + parseFloat(i.amount || 0), 0
        );
        flatDebitGroups.splice(openingStockFlatIndex, 1);
    }

    const closingStockFlatIndex = flatCreditGroups.findIndex(
        g => normalize(g.group) === 'closing stock'
    );

    if (closingStockFlatIndex !== -1) {
        const fallbackGroup = flatCreditGroups[closingStockFlatIndex];
        fallbackGroup.items.forEach(acc => {
            structuredGroupMap['Closing Stock'].items.push({
                label: acc.label,
                amount: acc.amount,
                quantity: undefined,
                source: 'account'
            });
        });
        structuredGroupMap['Closing Stock'].total = structuredGroupMap['Closing Stock'].items.reduce(
            (sum, i) => sum + parseFloat(i.amount || 0), 0
        );
        flatCreditGroups.splice(closingStockFlatIndex, 1);
    }

    const shortageQty = (
        sumQuantities('Opening Stock', structuredGroupMap) +
        sumQuantities('Purchase Account', structuredGroupMap) -
        sumQuantities('Sale Account', structuredGroupMap) -
        sumQuantities('Closing Stock', structuredGroupMap)
    );

    structuredGroupMap['Closing Stock'].items.push({
        label: 'Shortage',
        quantity: shortageQty,
        source: 'shortage'
    });

    const structuredGroups = Object.values(structuredGroupMap);
    const structuredDebitGroups = structuredGroups.filter(g => leftSet.has(normalize(g.group)));
    const structuredCreditGroups = structuredGroups.filter(g => rightSet.has(normalize(g.group)));

    const debitGroups = [...flatDebitGroups, ...structuredDebitGroups, debitNoteGroup];
    const creditGroups = [...flatCreditGroups, ...structuredCreditGroups, creditNoteGroup];

    const totalAmount = creditGroups.reduce((sum, g) => sum + g.total, 0);
    const debitTotal = debitGroups.reduce((sum, g) => sum + g.total, 0);

    // Filter zero-amount items before sorting
    const filteredDebitGroups = debitGroups.map(sanitizeGroupItems);
    const filteredCreditGroups = creditGroups.map(sanitizeGroupItems);

    const sortedDebitGroups = sortGroups(filteredDebitGroups, TRADING_ACCOUNT.LEFT_SIDE_GROUPS);
    const sortedCreditGroups = sortGroups(filteredCreditGroups, TRADING_ACCOUNT.RIGHT_SIDE_GROUPS);

    const totalQuantity = (
        sumQuantities('Opening Stock', structuredGroupMap) +
        sumQuantities('Purchase Account', structuredGroupMap)
    );

    const grossProfit = totalAmount > debitTotal ? totalAmount - debitTotal : null;
    const grossLoss = totalAmount < debitTotal ? debitTotal - totalAmount : null;

    return {
        debitGroups: sortedDebitGroups,
        creditGroups: sortedCreditGroups,
        grossProfit,
        grossLoss,
        debitTotalAmount: totalAmount,
        debitTotalQuantity: totalQuantity,
        creditTotalAmount: totalAmount,
        creditTotalQuantity: totalQuantity
    };
};
