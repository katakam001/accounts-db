exports.fetchTrialBalanceRows = async ({ db, userId, financialYear, fromDate, toDate }) => {

  const query = `
    WITH JournalEntries AS (
      SELECT id FROM journal_entries
      WHERE user_id = :userId
        AND financial_year = :financialYear
        AND journal_date BETWEEN :fromDate AND :toDate
    ),
    JournalItems AS (
      SELECT ji.group_id, ji.account_id, ji.amount, ji.type
      FROM journal_items ji
      JOIN JournalEntries je ON ji.journal_id = je.id
    ),
    CashEntries AS (
      SELECT ce.group_id, ce.account_id, ce.amount, ce.type
      FROM combined_cash_entries ce
      WHERE ce.user_id = :userId
        AND ce.financial_year = :financialYear
        AND cash_date BETWEEN :fromDate AND :toDate
    ),
    CombinedEntries AS (
      SELECT group_id, account_id, amount, type FROM JournalItems
      UNION ALL
      SELECT group_id, account_id, amount, type FROM CashEntries
    ),
    OpeningBalances AS (
      SELECT ag.group_id, al.id AS account_id,
             al.debit_balance AS opening_debit,
             al.credit_balance AS opening_credit
      FROM account_list al
      JOIN account_group ag ON al.id = ag.account_id
      WHERE user_id = :userId AND al.financial_year = :financialYear
    ),
    CombinedWithOpeningBalances AS (
      SELECT ce.group_id, ce.account_id,
             SUM(CASE WHEN ce.type THEN ce.amount ELSE 0 END) AS total_credit,
             SUM(CASE WHEN NOT ce.type THEN ce.amount ELSE 0 END) AS total_debit
      FROM CombinedEntries ce
      GROUP BY ce.group_id, ce.account_id
      UNION ALL
      SELECT ob.group_id, ob.account_id,
             ob.opening_credit AS total_credit,
             ob.opening_debit AS total_debit
      FROM OpeningBalances ob
    ),
    GroupedItems AS (
      SELECT g.id::text AS group_id, g.name AS group_name,
             al.id AS account_id, al.name AS account_name,
             SUM(cob.total_credit) AS total_credit,
             SUM(cob.total_debit) AS total_debit,
             SUM(cob.total_credit - cob.total_debit) AS balance
      FROM CombinedWithOpeningBalances cob
      JOIN group_list g ON cob.group_id = g.id
      LEFT JOIN account_list al ON cob.account_id = al.id
      GROUP BY g.id, g.name, al.id, al.name
    )
    SELECT group_name, account_name, account_id, COALESCE(balance, 0) AS balance
    FROM GroupedItems
    ORDER BY group_name, account_name;

  `;

  return db.sequelize.query(query, {
    replacements: { userId, fromDate, toDate, financialYear },
    type: db.sequelize.QueryTypes.SELECT
  });
};
