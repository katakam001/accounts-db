const { fetchTrialBalanceRows } = require('../../services/trialBalance.service');
const { generateStockValuationData } = require('../../services/stockValuation.service');
const { transformTrialBalanceRows } = require('../../utils/trialBalanceUtils');

exports.getTradingAccountData = async ({ db, userId, financialYear, fromDate, toDate }) => {
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
        fetchTrialBalanceRows({ db, userId, financialYear, fromDate, toDate }),
        Entry.findAll({
            attributes: [
                'type',
                'category_account_id',
                'item_id',
                [db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'total_quantity']
            ],
            where: {
                user_id: userId,
                financial_year: financialYear,
                type: [1, 2, 3, 4]
            },
            group: ['type', 'category_account_id', 'item_id'],
            raw: true
        }),
        CashSaleEntry.findAll({
            attributes: ['category_account_id', [db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'total_quantity']],
            where: { user_id: userId, financial_year: financialYear, type: 8 },
            group: ['category_account_id'],
            raw: true
        }),
        generateStockValuationData({ db, user_id: userId, financial_year: financialYear, start_date: fromDate, end_date: toDate })
    ]);

    // Step 2: Fetch valuation + stock register data
    const [stockValuations, openingQuantities, closingQuantities] = await Promise.all([
        StockValuation.findAll({
            where: { user_id: userId, financial_year: financialYear, start_date: fromDate, end_date: toDate },
            attributes: [
                'item_id',
                'opening_stock_valuation',
                'closing_stock_valuation',
                [db.sequelize.col('item.name'), 'item_name']
            ],
            include: [{ model: db.items, as: 'item', attributes: [] }],
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

    const { groupedAccounts } = transformTrialBalanceRows(trialBalanceRows);

    return {
        allEntryQuantities,
        cashSaleQuantities,
        stockValuations,
        openingQuantities,
        closingQuantities,
        groupedAccounts
    };
};
