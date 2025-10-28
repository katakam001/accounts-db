module.exports = {
  TRADING_ACCOUNT: {
    LEFT_SIDE_GROUPS: [
      'Opening Stock',
      'Purchase Account',
      'Direct Expenses',
      'Debit Note Account'
    ],
    RIGHT_SIDE_GROUPS: [
      'Sale Account',
      'Credit Note Account',
      'Closing Stock',
      'Direct Income',
    ],
    STRUCTURED_GROUPS: [
      'Opening Stock',
      'Closing Stock',
      'Purchase Account',
      'Sale Account'
    ],
    RELATED_GROUPS: [
      'Purchase Account',
      'Sale Account',
      'Purchase Return Account',
      'Sale Return Account',
      'Debit Note Account',
      'Credit Note Account'
    ],
    FILTER_GROUPS: [
      'Purchase Account',
      'Sale Account',
      'Debit Note Account',
      'Credit Note Account'
    ]
  },

  PROFIT_LOSS: {
    LEFT_SIDE_GROUPS: [
      'Gross Loss',
      'Salaries',
      'Indirect Expenses',
      'Depreciation'
    ],
    RIGHT_SIDE_GROUPS: [
      'Gross Profit',
      'Indirect Income',
    ],
    STRUCTURED_GROUPS: [],
    FILTER_GROUPS: []
  },

  BALANCE_SHEET: {
    LEFT_SIDE_GROUPS: [
      'Capital Account',
      'Loans (Liability)',
      'Current Liabilities',
      'Reserves and Surplus'
    ],
    RIGHT_SIDE_GROUPS: [
      'Fixed Assets',
      'Investments',
      'Current Assets',
      'Miscellaneous Expenses'
    ],
    STRUCTURED_GROUPS: [] // optional
  }
};