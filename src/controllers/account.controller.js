const db = require("../models");
const Account = db.account;

exports.accountList = async (req, res) => {
  try {
    const accounts = await Account.findAll();
    res.status(200).json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.accountUpdate = async (req, res) => {
  const { id } = req.params;
  const { name, description,  user_id,  balance, financial_year } = req.body;
  try {
    const account = await Account.findByPk(id);
    if (!account) {
      return res.status(404).send('Account not found');
    }
    account.name = name;
    account.description = description;
    account.date_updated = new Date();
    account.user_id=user_id;
    account.balance=balance;
    account.financial_year=financial_year;
    await account.save();
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
    await account.destroy();
    console.log("status" + 204);
    res.status(200).send({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).send(error);
  }
};

exports.accountCreate = async (req, res) => {
  console.log(req.body);
  const { name, description,  user_id,  balance, financial_year } = req.body;
  try {
    const newAccount = await Account.create({
      name,
      description,
      user_id,
      balance,
      financial_year
    });
    res.status(201).send(newAccount);
  } catch (error) {
    res.status(500).send(error);
  }
};


