exports.fetchSummary = async ({ db, userId, financialYear, fromDate, toDate }) => {
  const query = `
    WITH JournalEntries AS (
      SELECT id FROM journal_entries
      WHERE user_id = :userId
        AND financial_year = :financialYear
        AND journal_date BETWEEN :fromDate AND :toDate
    ),
    JournalItems AS (
      SELECT ji.account_id, ji.amount, ji.type
      FROM journal_items ji
      JOIN JournalEntries je ON ji.journal_id = je.id
    ),
    CashEntries AS (
      SELECT ce.account_id, ce.amount, ce.type
      FROM combined_cash_entries ce
      WHERE ce.user_id = :userId
        AND ce.financial_year = :financialYear
        AND cash_date BETWEEN :fromDate AND :toDate
    ),
    CombinedEntries AS (
      SELECT account_id, amount, type FROM JournalItems
      UNION ALL
      SELECT account_id, amount, type FROM CashEntries
    ),
    OpeningBalances AS (
      SELECT al.id AS account_id,
             al.name AS account_name,
             al.debit_balance AS opening_debit,
             al.credit_balance AS opening_credit
      FROM account_list al
      WHERE user_id = :userId AND al.financial_year = :financialYear
    ),
    Aggregated AS (
      SELECT ce.account_id,
             SUM(CASE WHEN ce.type THEN ce.amount ELSE 0 END) AS total_credit,
             SUM(CASE WHEN NOT ce.type THEN ce.amount ELSE 0 END) AS total_debit
      FROM CombinedEntries ce
      GROUP BY ce.account_id
      UNION ALL
      SELECT ob.account_id,
             ob.opening_credit AS total_credit,
             ob.opening_debit AS total_debit
      FROM OpeningBalances ob
    ),
    GroupedAccounts AS (
      SELECT al.id AS account_id, al.name AS account_name,
             SUM(a.total_credit) AS total_credit,
             SUM(a.total_debit) AS total_debit
      FROM Aggregated a
      JOIN account_list al ON a.account_id = al.id
      GROUP BY al.id, al.name
    )
    SELECT account_id, account_name,
           COALESCE(total_credit,0) AS total_credit,
           COALESCE(total_debit,0) AS total_debit
    FROM GroupedAccounts
    ORDER BY account_name;
  `;

  const rows = await db.sequelize.query(query, {
    replacements: { userId, fromDate, toDate, financialYear },
    type: db.sequelize.QueryTypes.SELECT
  });

  // ✅ Get Opening Cash directly from account_list
  const cashAccount = await db.account.findOne({
    where: { user_id: userId, financial_year: financialYear, name: 'CASH' }
  });

  // Helper to round to 2 decimals
  const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

  let openingCash = 0;
  if (cashAccount) {
    const debit = round2(cashAccount.debit_balance || 0);
    const credit = round2(cashAccount.credit_balance || 0);

    // Use whichever side has a non-zero balance
    if (debit !== 0) {
      openingCash = debit;
    } else if (credit !== 0) {
      openingCash = credit;
    }
  }

  const receipts = [];
  const payments = [];

  rows.forEach(row => {
    if (row.account_name.toUpperCase() === "CASH") {
      return; // 🚫 Skip CASH account itself
    }

    const credit = round2(Number(row.total_credit) || 0);
    const debit = round2(Number(row.total_debit) || 0);

    if (credit > 0) {
      receipts.push({ accountId: row.account_id, accountName: row.account_name, amount: credit });
    }
    if (debit > 0) {
      payments.push({ accountId: row.account_id, accountName: row.account_name, amount: debit });
    }
  });

  // ✅ Compute totals directly from arrays (rounded)
  const totalReceipts = round2(receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0));
  const totalPayments = round2(payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));

  // ✅ Closing Cash computed after arrays are complete
  const closingCash = round2(openingCash + totalReceipts - totalPayments);

  // Add Opening Cash to receipts
  receipts.unshift({ accountId: cashAccount?.id, accountName: "Opening Cash", amount: round2(openingCash) });

  // Add Closing Cash to payments
  payments.push({ accountId: cashAccount?.id, accountName: "Closing Cash", amount: closingCash });

  // ✅ Totals derived from arrays (rounded)
  return {
    receipts,
    payments,
    totals: {
      totalReceipts: round2(receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)),
      totalPayments: round2(payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)),
      net: round2(
        receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) -
        payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      )
    }
  };
};
