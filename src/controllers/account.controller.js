const db = require("../models");
const Account = db.account;
const Group = db.group;

exports.accountList = async (req, res) => {
  try {
    const userId = req.query.userId;
    const financialYear = req.query.financialYear;
    const groups = req.query.groups ? req.query.groups.split(',') : null;
    console.log(groups);

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }
    if (!financialYear) {
      return res.status(400).json({ error: 'financialYear query parameter is required' });
    }

    const includeGroups = {
      model: Group,
      as: 'groups',
      through: { attributes: [] } // Exclude the join table attributes
    };

    if (groups) {
      includeGroups.where = { name: groups };
    }

    const accounts = await Account.findAll({
      where: {
        user_id: userId,
        financial_year: financialYear
      },
      include: [includeGroups]
    });

    // Transform the data to the desired format
    const transformedAccounts = accounts.map(account => {
      const groups = account.groups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        financial_year: group.financial_year,
        user_id: group.user_id
      }));

      return {
        id: account.id,
        name: account.name,
        description: account.description,
        user_id: account.user_id,
        debit_balance: account.debit_balance,
        credit_balance: account.credit_balance,
        financial_year: account.financial_year,
        groups: groups.length > 0 ? groups : null
      };
    });

    res.status(200).json(transformedAccounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};



exports.accountUpdate = async (req, res) => {
  const { id } = req.params;
  const { name, description, user_id, debit_balance, credit_balance, financial_year, groups } = req.body;
  try {
    const account = await Account.findByPk(id);
    if (!account) {
      return res.status(404).send('Account not found');
    }
    account.name = name;
    account.description = description;
    account.date_updated = new Date();
    account.user_id = user_id;
    account.debit_balance = debit_balance;
    account.credit_balance = credit_balance;
    account.financial_year = financial_year;
    await account.save();

    if (groups && groups.length > 0) {
      const groupIds = groups.map(group => group.id);
      await account.setGroups(groupIds);
    }
    res.send(account);
  } catch (error) {
    res.status(500).send(error);
  }
};

// Delete Account
exports.accountDelete = async (req, res) => {
  const { id } = req.params;
  try {
    const account = await Account.findByPk(id);
    console.log(account);
    if (!account) {
      return res.status(404).send('Account not found');
    }
    await account.setGroups([]); // Remove associations with groups
    await account.destroy();
    res.status(200).send({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.accountCreate = async (req, res) => {
  console.log(req.body);
  const { name, description, user_id, debit_balance, credit_balance, financial_year, groups } = req.body;
  try {
    const newAccount = await Account.create({
      name,
      description,
      user_id,
      debit_balance,
      credit_balance,
      financial_year
    });
    console.log(newAccount);

    if (groups && groups.length > 0) {
      const groupIds = groups.map(group => group.id);
      await newAccount.setGroups(groupIds);
    }

    res.status(201).send(newAccount);
  } catch (error) {
    res.status(500).send(error);
  }
};
