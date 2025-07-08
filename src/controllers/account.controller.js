const { getDb } = require("../utils/getDb");

exports.accountList = async (req, res) => {
  try {
    const db = getDb();
    const Account = db.account;
    const Group = db.group;
    const Address = db.address;
    const userId = req.query.userId;
    const financialYear = req.query.financialYear;
    const groups = req.query.groups ? req.query.groups.split(',') : null;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }
    if (!financialYear) {
      return res.status(400).json({ error: 'financialYear query parameter is required' });
    }

    const includeGroups = {
      model: Group,
      as: 'group',
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
      include: [
        includeGroups,
        {
          model: Address,
          as: 'address'
        }
      ]
    });
    // Transform the data to the desired format
    const transformedAccounts = accounts.map(account => {
      const group = account.group && account.group.length > 0 ? {
        id: account.group[0].id,
        name: account.group[0].name,
        description: account.group[0].description,
        financial_year: account.group[0].financial_year,
        user_id: account.group[0].user_id
      } : null;

      return {
        id: account.id,
        name: account.name,
        gst_no: account.gst_no,
        user_id: account.user_id,
        debit_balance: account.debit_balance,
        credit_balance: account.credit_balance,
        financial_year: account.financial_year,
        isDealer: account.isDealer,
        group: group,
        address: account.address ? {
          street: account.address.street,
          city: account.address.city,
          state: account.address.state,
          postal_code: account.address.postal_code,
          country: account.address.country
        } : null
      };
    });

    res.status(200).json(transformedAccounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getAccount = async (req, res) => {
  try {
    const db = getDb();
    const Account = db.account;
    const Group = db.group;
    const Address = db.address;
    const accountName = req.params.name;
    const accountId = req.params.id;
    const userId = req.query.userId;
    const financialYear = req.query.financialYear;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }
    if (!financialYear) {
      return res.status(400).json({ error: 'financialYear query parameter is required' });
    }

    let whereClause = {
      user_id: userId,
      financial_year: financialYear
    };

    if (accountName) {
      whereClause.name = accountName;
    } else if (accountId) {
      whereClause.id = accountId;
    } else {
      return res.status(400).json({ error: 'Either accountName or accountId parameter is required' });
    }

    const account = await Account.findOne({
      where: whereClause,
      include: [
        {
          model: Group,
          as: 'group',
          through: { attributes: [] } // Exclude the join table attributes
        },
        {
          model: Address,
          as: 'address'
        }
      ]
    });

    if (account) {
      // Transform the data to the desired format
      const transformedAccount = {
        id: account.id,
        name: account.name,
        gst_no: account.gst_no,
        user_id: account.user_id,
        debit_balance: account.debit_balance,
        credit_balance: account.credit_balance,
        financial_year: account.financial_year,
        isDealer: account.isDealer,
        group: account.group ? {
          id: account.group.id,
          name: account.group.name,
          description: account.group.description,
          financial_year: account.group.financial_year,
          user_id: account.group.user_id
        } : null,
        address: account.address ? {
          street: account.address.street,
          city: account.address.city,
          state: account.address.state,
          postal_code: account.address.postal_code,
          country: account.address.country
        } : null
      };

      res.status(200).json(transformedAccount);
    } else {
      res.status(404).json({ message: 'Account not found' });
    }
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.accountUpdate = async (req, res) => {
  const { name, gst_no, user_id, debit_balance, credit_balance, financial_year, isDealer, group, address } = req.body;
  try {
    const db = getDb();
    const Account = db.account;
    const Group = db.group;
    const Address = db.address;
    const AccountGroup = db.accountGroup;
    const { id } = req.params;
    const account = await Account.findByPk(id);
    if (!account) {
      return res.status(404).send('Account not found');
    }
    account.name = name;
    account.gst_no = gst_no;
    account.date_updated = new Date();
    account.user_id = user_id;
    account.debit_balance = debit_balance;
    account.credit_balance = credit_balance;
    account.financial_year = financial_year;
    account.isDealer = isDealer;
    await account.save();
    console.log(group);

    let groupData = null;
    if (group) {
      // Check if the exact mapping already exists
      const existingPair = await AccountGroup.findOne({
        where: { account_id: id, group_id: group }
      });

      if (!existingPair) {
        // Remove any previous mapping for this account
        await AccountGroup.destroy({ where: { account_id: id } });

        // Create new mapping
        await AccountGroup.create({ account_id: id, group_id: group });
      }

      const groupExist = await Group.findByPk(group);
      if (groupExist) {
        groupData = {
          id: groupExist.id,
          name: groupExist.name,
          description: groupExist.description,
          financial_year: groupExist.financial_year,
          user_id: groupExist.user_id
        };
      }
    }
    console.log(groupData);

    if (address) {
      const existingAddress = await Address.findOne({ where: { account_id: id } });
      if (existingAddress) {
        existingAddress.street = address.street;
        existingAddress.city = address.city;
        existingAddress.state = address.state;
        existingAddress.postal_code = address.postal_code;
        existingAddress.country = address.country;
        await existingAddress.save();
      } else {
        await Address.create({
          account_id: id,
          street: address.street,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country
        });
      }
    }

    const response = {
      id: account.id,
      name: account.name,
      gst_no: account.gst_no,
      user_id: account.user_id,
      debit_balance: account.debit_balance,
      credit_balance: account.credit_balance,
      financial_year: account.financial_year,
      isDealer: account.isDealer,
      group: groupData,
      address: address ? {
        street: address.street,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country
      } : null
    };

    res.send(response);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      // Send error response with meaningful message
      res.status(400).json({
        error: 'Duplicate account name detected',
        message: `The account name "${name}" already exists. Please choose a unique name.`
      });
    } else {
      // Handle other errors
      console.error('Error while updating the account:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing your request.'
      });
    }
  }
};

exports.accountDelete = async (req, res) => {
  const db = getDb();
  const transaction = await db.sequelize.transaction(); // Start a transaction
  try {
    const Account = db.account;
    const Address = db.address;
    const AccountGroup = db.accountGroup;
    const { id } = req.params;

    // Check if the account exists
    const account = await Account.findByPk(id, { transaction });
    if (!account) {
      await transaction.rollback(); // Rollback transaction if account not found
      return res.status(404).json({ message: 'Account not found' });
    }

    // Check if account group exists and remove it
    const accountGroup = await AccountGroup.findOne({ where: { account_id: id }, transaction });
    if (accountGroup) {
      await AccountGroup.destroy({ where: { account_id: id }, transaction });
    }

    // Check if address exists and remove it
    const address = await Address.findOne({ where: { account_id: id }, transaction });
    if (address) {
      await Address.destroy({ where: { account_id: id }, transaction });
    }

    // Delete the account
    await account.destroy({ transaction });

    // Commit the transaction after successful deletions
    await transaction.commit();
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    // Rollback the transaction in case of errors
    await transaction.rollback();
    console.error('Error deleting account:', error);

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({
        error: 'foreign key constraint',
        message: `Cannot delete account due to foreign key constraint.`,
        detail: error.parent.detail || error.message, // Provide database-generated details
      });
    } else {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
};

exports.accountCreate = async (req, res) => {
  const { name, gst_no, user_id, debit_balance, credit_balance, financial_year, isDealer, group, address } = req.body;
  try {
    const db = getDb();
    const Account = db.account;
    const Group = db.group;
    const Address = db.address;
    const AccountGroup = db.accountGroup;
    const newAccount = await Account.create({
      name,
      gst_no,
      user_id,
      debit_balance,
      credit_balance,
      financial_year,
      isDealer
    });

    let groupData = null;
    if (group) {
      await AccountGroup.create({ account_id: newAccount.id, group_id: group });
      const groupExist = await Group.findByPk(group);
      if (groupExist) {
        groupData = {
          id: groupExist.id,
          name: groupExist.name,
          description: groupExist.description,
          financial_year: groupExist.financial_year,
          user_id: groupExist.user_id
        };
      }
    }

    let addressData = null;
    if (address) {
      const newAddress = await Address.create({
        account_id: newAccount.id,
        street: address.street,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country
      });
      addressData = {
        street: newAddress.street,
        city: newAddress.city,
        state: newAddress.state,
        postal_code: newAddress.postal_code,
        country: newAddress.country
      };
    }

    const response = {
      id: newAccount.id,
      name: newAccount.name,
      gst_no: newAccount.gst_no,
      user_id: newAccount.user_id,
      debit_balance: newAccount.debit_balance,
      credit_balance: newAccount.credit_balance,
      financial_year: newAccount.financial_year,
      isDealer: newAccount.isDealer,
      group: groupData,
      address: addressData
    };

    res.status(201).send(response);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError" && error.parent?.code === "23505") {
      // Send error response with meaningful message
      res.status(400).json({
        error: 'Duplicate account name detected',
        message: `The account name "${name}" already exists. Please choose a unique name.`
      });
    } else {
      // Handle other errors
      console.error('Error inserting account:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing your request.'
      });
    }
  }
};
