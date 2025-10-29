
const { TRADING_ACCOUNT } = require('../constants/groupMeta');
const { normalize } = require('./tradingAccount/groupUtils');
const { getTradingAccountData } = require('./tradingAccount/dataFetcher');
const { calculateTradingAccountData, finalizeTradingAccountGroups } = require('./tradingAccount/reportBuilder');

exports.calculateTradingAccountReport = async ({ db, userId, financialYear, fromDate, toDate }) => {
    const leftSet = new Set(TRADING_ACCOUNT.LEFT_SIDE_GROUPS.map(normalize));
    const rightSet = new Set(TRADING_ACCOUNT.RIGHT_SIDE_GROUPS.map(normalize));

    const {
        allEntryQuantities,
        cashSaleQuantities,
        stockValuations,
        openingQuantities,
        closingQuantities,
        groupedAccounts
    } = await getTradingAccountData({ db, userId, financialYear, fromDate, toDate });

    const {
        structuredGroupMap,
        debitNoteGroup,
        creditNoteGroup,
        flatGroupsLeft,
        flatGroupsRight
    } = calculateTradingAccountData({
        groupedAccounts,
        allEntryQuantities,
        cashSaleQuantities,
        stockValuations,
        openingQuantities,
        closingQuantities,
        leftSet,
        rightSet
    });

    return finalizeTradingAccountGroups({
        structuredGroupMap,
        flatDebitGroups: flatGroupsLeft,
        flatCreditGroups: flatGroupsRight,
        debitNoteGroup,
        creditNoteGroup,
        leftSet,
        rightSet
    });
};

exports.buildTradingAccountReport  = ({
    groupedAccounts,
    allEntryQuantities,
    cashSaleQuantities,
    stockValuations,
    openingQuantities,
    closingQuantities,
    leftSet,
    rightSet
}) => {
    const {
        structuredGroupMap,
        debitNoteGroup,
        creditNoteGroup,
        flatGroupsLeft,
        flatGroupsRight
    } = calculateTradingAccountData({
        groupedAccounts,
        allEntryQuantities,
        cashSaleQuantities,
        stockValuations,
        openingQuantities,
        closingQuantities,
        leftSet,
        rightSet
    });

    return finalizeTradingAccountGroups({
        structuredGroupMap,
        flatDebitGroups: flatGroupsLeft,
        flatCreditGroups: flatGroupsRight,
        debitNoteGroup,
        creditNoteGroup,
        leftSet,
        rightSet
    });

};

