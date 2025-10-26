const { getDb } = require('../utils/getDb');
const { fetchTrialBalanceRows } = require('../services/trialBalance.service');
const { transformTrialBalanceRows } = require('../utils/trialBalanceUtils');
const { generateStockValuationData } = require('../services/stockValuation.service');
const { TRADING_ACCOUNT } = require('../constants/groupMeta');


exports.calculateTradingAccount = async (req, res) => {
    const userId = req.body.userId;
    const financialYear = req.body.financialYear;
    const fromDate = req.body.fromDate ? new Date(req.body.fromDate) : null;
    const toDate = req.body.toDate ? new Date(req.body.toDate) : null;

    const db = getDb();
    const normalize = name => name.trim().toLowerCase();
    const leftSet = new Set(TRADING_ACCOUNT.LEFT_SIDE_GROUPS.map(normalize));
    const rightSet = new Set(TRADING_ACCOUNT.RIGHT_SIDE_GROUPS.map(normalize));

    const Entry = db.entry;
    const CashSaleEntry = db.cashSaleEntries;
    const StockValuation = db.stock_valulation;
    const StockRegister = db.stock_register;

    // Step 1: Run independent queries in parallel
    const [
        trialBalanceRows,
        allEntryQuantities,
        cashSaleQuantities,
        _valuationCall
    ] = await Promise.all([
        fetchTrialBalanceRows({
            db,
            userId,
            financialYear,
            fromDate,
            toDate
        }),
        Entry.findAll({
            attributes: [
                'type',
                'category_id',
                'item_id',
                [db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'total_quantity']
            ],
            where: {
                user_id: userId,
                financial_year: financialYear,
                type: [1, 2, 3, 4] // ✅ Fetch all relevant types
            },
            group: ['type', 'category_id', 'item_id'],
            raw: true
        }),
        CashSaleEntry.findAll({
            attributes: ['category_id', [db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'total_quantity']],
            where: { user_id: userId, financial_year: financialYear, type: 8 },
            group: ['category_id'],
            raw: true
        }),
        generateStockValuationData({
            db,
            user_id: userId,
            financial_year: financialYear,
            start_date: fromDate,
            end_date: toDate
        })
    ]);


    // Step 3: Fetch valuation + stock register data
    const [stockValuations, openingQuantities, closingQuantities] = await Promise.all([

        StockValuation.findAll({
            where: {
                user_id: userId,
                financial_year: financialYear,
                start_date: fromDate,
                end_date: toDate
            },
            attributes: [
                'item_id',
                'opening_stock_valuation',
                'closing_stock_valuation',
                [db.sequelize.col('item.name'), 'item_name']
            ],
            include: [
                { model: db.items, as: 'item', attributes: [] }
            ],
            order: [['item_id', 'ASC']],
            raw: true
        }),

        StockRegister.findAll({
            attributes: ['item_id', ['opening_balance', 'quantity']],
            where: { user_id: userId, financial_year: financialYear, entry_date: fromDate },
            raw: true
        }),

        StockRegister.findAll({
            attributes: ['item_id', ['closing_balance', 'quantity']],
            where: { user_id: userId, financial_year: financialYear, entry_date: toDate },
            raw: true
        })
    ]);

    // Step 4: Transform trial balance
    const { groupedAccounts } = transformTrialBalanceRows(trialBalanceRows);
    console.log(groupedAccounts);
    console.log(allEntryQuantities);
    console.log(cashSaleQuantities);
    console.log(stockValuations);
    console.log(openingQuantities);
    console.log(closingQuantities);

    const purchaseQuantities = [];
    const saleQuantities = [];
    const purchaseReturnQuantities = [];
    const saleReturnQuantities = [];

    allEntryQuantities.forEach(row => {
        switch (row.type) {
            case 1: purchaseQuantities.push(row); break;
            case 2: saleQuantities.push(row); break;
            case 3: purchaseReturnQuantities.push(row); break;
            case 4: saleReturnQuantities.push(row); break;
        }
    });

    const itemToPurchaseAccountMap = new Map();
    purchaseQuantities.forEach(row => {
        itemToPurchaseAccountMap.set(row.item_id, row.category_id);
    });

    const itemToPurchaseReturnAccountMap = new Map();
    purchaseReturnQuantities.forEach(row => {
        itemToPurchaseReturnAccountMap.set(row.item_id, row.category_id);
    });

    const itemToSaleAccountMap = new Map();
    saleQuantities.forEach(row => {
        itemToSaleAccountMap.set(row.item_id, row.category_id);
    });

    const itemToSaleReturnAccountMap = new Map();
    saleReturnQuantities.forEach(row => {
        itemToSaleReturnAccountMap.set(row.item_id, row.category_id);
    });

    const relatedGroupSet = new Set(TRADING_ACCOUNT.RELATED_GROUPS.map(normalize));

    const relatedGroupMap = {};
    groupedAccounts.forEach(g => {
        const key = normalize(g.groupName);
        if (relatedGroupSet.has(key)) {
            relatedGroupMap[key] = g.accounts;
        }
    });

    const purchaseAccounts = relatedGroupMap['purchase account'] || [];
    const saleAccounts = relatedGroupMap['sale account'] || [];
    const purchaseReturnAccounts = relatedGroupMap['purchase return account'] || [];
    const saleReturnAccounts = relatedGroupMap['sale return account'] || [];
    const debitNoteAccounts = relatedGroupMap['debit note account'] || [];
    const creditNoteAccounts = relatedGroupMap['credit note account'] || [];

    // Step 5: Build structured group placeholders
    const structuredGroupMap = TRADING_ACCOUNT.STRUCTURED_GROUPS.reduce((acc, groupName) => {
        acc[groupName] = {
            group: groupName,
            groupMode: 'structured',
            items: [],
            total: 0
        };
        return acc;
    }, {});

    // Step 6: Populate structured groups
    structuredGroupMap['Opening Stock'].items = stockValuations.map(row => ({
        label: row.item_name, // ✅ Use item name instead of item_id
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
    structuredGroupMap['Purchase Account'].items = purchaseAccounts.map(acc => {
        const purchaseQtyRow = purchaseQuantities.find(q => q.category_id === acc.account_id);
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
        const returnAmount = returnAcc ? (returnAcc.debit ?? returnAcc.credit ?? 0) : 0;

        const amount = (acc.debit ?? acc.credit ?? 0) - returnAmount;
        const label = acc.accountName.replace(/^PURCHASE OF\s*/i, '');

        return {
            label,
            item_id: itemId,
            amount,
            quantity: purchaseQty - returnQty,
            source: 'item'
        };
    });
    structuredGroupMap['Purchase Account'].total = structuredGroupMap['Purchase Account'].items.reduce(
        (sum, i) => sum + parseFloat(i.amount || 0), 0
    );
    structuredGroupMap['Sale Account'].items = saleAccounts.map(acc => {
        const saleQtyRow = saleQuantities.find(q => q.category_id === acc.account_id)
            || cashSaleQuantities.find(q => q.category_id === acc.account_id);
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
        const returnAmount = returnAcc ? (returnAcc.debit ?? returnAcc.credit ?? 0) : 0;

        const amount = (acc.debit ?? acc.credit ?? 0) - returnAmount;
        const label = acc.accountName.replace(/^SALE OF\s*/i, '');

        return {
            label,
            item_id: itemId,
            amount,
            quantity: saleQty - returnQty,
            source: 'item'
        };
    });
    structuredGroupMap['Sale Account'].total = structuredGroupMap['Sale Account'].items.reduce(
        (sum, i) => sum + parseFloat(i.amount || 0), 0
    );

    const debitNoteTotal = debitNoteAccounts.reduce(
        (sum, acc) => sum + parseFloat(acc.debit ?? acc.credit ?? 0), 0
    );

    const creditNoteTotal = creditNoteAccounts.reduce(
        (sum, acc) => sum + parseFloat(acc.credit ?? acc.debit ?? 0), 0
    );

    const debitNoteGroup = {
        group: 'Debit Note Account',
        groupMode: 'flat',
        items: [{
            label: 'Debit Note Account',
            amount: debitNoteTotal,
            source: 'group'
        }],
        total: debitNoteTotal
    };

    const creditNoteGroup = {
        group: 'Credit Note Account',
        groupMode: 'flat',
        items: [{
            label: 'Credit Note Account',
            amount: creditNoteTotal,
            source: 'group'
        }],
        total: creditNoteTotal
    };

    // Step 7: Map flat trial balance groups

    const filterGroupSet = new Set(TRADING_ACCOUNT.FILTER_GROUPS.map(normalize));

    const mapFlatGroups = (groups, sideSet) =>
        groups.map(g => {
            const groupKey = g.groupName;
            const normalizedKey = normalize(groupKey);

            // ✅ Skip if group is in FILTER_GROUPS
            if (filterGroupSet.has(normalizedKey)) return null;

            const isStructured = TRADING_ACCOUNT.STRUCTURED_GROUPS.includes(groupKey);

            const items = g.accounts
                .filter(acc => {
                    if (!sideSet.has(normalizedKey)) return false;

                    if (!isStructured) return true;

                    const structuredItems = structuredGroupMap[groupKey]?.items || [];
                    return !structuredItems.some(i => i.label === acc.accountName);
                })
                .map(acc => ({
                    label: acc.accountName,
                    amount: acc.debit != null ? acc.debit : acc.credit,
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


    const flatDebitGroups = mapFlatGroups(groupedAccounts, leftSet);
    const flatCreditGroups = mapFlatGroups(groupedAccounts, rightSet);

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

        flatDebitGroups.splice(openingStockFlatIndex, 1); // ✅ Remove from flat groups
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

        flatCreditGroups.splice(closingStockFlatIndex, 1); // ✅ Remove from flat groups
    }

    const shortageQty = (
        sumQuantities('Opening Stock', structuredGroupMap) +
        sumQuantities('Purchase Account', structuredGroupMap) -
        sumQuantities('Sale Account', structuredGroupMap) -
        sumQuantities('Closing Stock', structuredGroupMap)
    );

    // ✅ Inject shortage as final item
    structuredGroupMap['Closing Stock'].items.push({
        label: 'Shortage',
        quantity: shortageQty,
        source: 'shortage'
    });

    // Step 8: Merge and compute totals
    const structuredGroups = Object.values(structuredGroupMap);
    const structuredDebitGroups = structuredGroups.filter(g => leftSet.has(normalize(g.group)));
    const structuredCreditGroups = structuredGroups.filter(g => rightSet.has(normalize(g.group)));

    const debitGroups = [...flatDebitGroups, ...structuredDebitGroups, debitNoteGroup];
    const creditGroups = [...flatCreditGroups, ...structuredCreditGroups, creditNoteGroup];

    // ✅ Total amount from credit side
    const totalAmount = creditGroups.reduce((sum, g) => sum + g.total, 0);
    const debitTotal = debitGroups.reduce((sum, g) => sum + g.total, 0);

    const sortedDebitGroups = sortGroups(debitGroups, TRADING_ACCOUNT.LEFT_SIDE_GROUPS);
    const sortedCreditGroups = sortGroups(creditGroups, TRADING_ACCOUNT.RIGHT_SIDE_GROUPS);

    // ✅ Total quantity from Opening + Purchase
    const totalQuantity = (
        sumQuantities('Opening Stock', structuredGroupMap) +
        sumQuantities('Purchase Account', structuredGroupMap)
    );

    const grossProfit = totalAmount > debitTotal ? totalAmount - debitTotal : null;
    const grossLoss = totalAmount < debitTotal ? debitTotal - totalAmount : null;

    res.json({
        debitGroups: sortedDebitGroups,
        creditGroups: sortedCreditGroups,
        grossProfit,
        grossLoss,
        debitTotalAmount: totalAmount,
        debitTotalQuantity: totalQuantity,
        creditTotalAmount: totalAmount,
        creditTotalQuantity: totalQuantity
    });

};


function sumQuantities(groupName, structuredGroupMap) {
    const items = structuredGroupMap[groupName]?.items || [];
    return items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
}

function sortGroups(groups, order) {
    return order.map(name => groups.find(g => g.group === name)).filter(Boolean);
}