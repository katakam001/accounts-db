exports.transformTrialBalanceRows = (rows) => {
  const grouped = {};

  rows.forEach(row => {
    const { group_name, account_name,account_id, balance } = row;
    const amount = Math.abs(balance);
    const isCredit = balance > 0;

    if (!grouped[group_name]) {
      grouped[group_name] = [];
    }

    grouped[group_name].push({
      accountName: account_name,
      account_id,
      debit: isCredit ? 0 : amount,
      credit: isCredit ? amount : 0
    });
  });

  const groupedAccounts = Object.entries(grouped).map(([group_name, accounts]) => ({
    groupName: group_name,
    accounts
  }));

  const totalDebit = groupedAccounts.flatMap(g => g.accounts).reduce((sum, acc) => sum + acc.debit, 0);
  const totalCredit = groupedAccounts.flatMap(g => g.accounts).reduce((sum, acc) => sum + acc.credit, 0);

  return { groupedAccounts, totalDebit, totalCredit };
};
