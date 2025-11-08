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
      'God',
      'Unsecured Loans',
      'Secured Loans',
      'Sundry Creditors',
      'Liability For Expenses',
      'Provisions'
    ],
    RIGHT_SIDE_GROUPS: [
      'Fixed Assets',
      'Deposits',
      'Investments',
      'Sundry Debtors',
      'Closing Stock',
      'Loans and Advances',
      'Bank Account',
      'Cash On Hand'
    ],
    STRUCTURED_GROUPS: [
      {
        group: 'Secured Loans',
        displayMode: 'nested' // subgroups with their own accounts
      },
      {
        group: 'Loans and Advances',
        displayMode: 'mixed', // subgroups + direct accounts
        subGroups: [
          'Advance For Expenses',
          'Advance Tax & TDS',
          'Prepaid Expenses'
        ]
      },
      {
        group: 'Bank Account',
        displayMode: 'flat' // individual accounts only
      },
      {
        group: 'Capital Account',
        displayMode: 'flat'
      }
    ],
    RELATIONSHIP_GROUPS: [
      {
        parent: 'Loans and Advances',
        children: [
          'Advance For Expenses',
          'Advance Tax & TDS',
          'Prepaid Expenses'
        ],
        source: 'static'
      },
      {
        parent: 'Secured Loans',
        children: [], // dynamically injected from DB
        source: 'dynamic'
      }
    ]
  }

};