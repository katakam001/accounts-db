exports.transformTrialBalanceRows = (rows) => {
  const grouped = {};

  rows.forEach(row => {
    const { group_name, account_name, account_id, balance } = row;
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

  // 🔹 Convert to array and filter out groups with net balance = 0
  const groupedAccounts = Object.entries(grouped)
    .map(([group_name, accounts]) => {
      const groupBalance = accounts.reduce((sum, acc) => sum + acc.credit - acc.debit, 0);
      return { groupName: group_name, accounts, groupBalance };
    })
    .filter(group => group.groupBalance !== 0) // ✅ remove groups with zero balance
    .map(({ groupName, accounts }) => ({ groupName, accounts })); // strip groupBalance from final output

  const totalDebit = groupedAccounts.flatMap(g => g.accounts).reduce((sum, acc) => sum + acc.debit, 0);
  const totalCredit = groupedAccounts.flatMap(g => g.accounts).reduce((sum, acc) => sum + acc.credit, 0);

  return { groupedAccounts, totalDebit, totalCredit };
};
