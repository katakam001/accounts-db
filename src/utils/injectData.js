const checkAndInjectUnits = async (db, units) => {
    const existingUnits = await db.units.findAll({
      where: {
        id: {
          [db.Sequelize.Op.in]: units.map(unit => unit.id)
        }
      }
    });
  
    if (existingUnits.length === 0) {
      await db.units.bulkCreate(units);
      console.log('Units injected successfully!');
    } else {
      console.log('Units already exist, skipping injection.');
    }
  };
  
  const checkAndInjectRoles = async (db, roles) => {
    const existingRoles = await db.role.findAll({
      where: {
        id: {
          [db.Sequelize.Op.in]: roles.map(role => role.id)
        }
      }
    });
  
    if (existingRoles.length === 0) {
      await db.role.bulkCreate(roles);
      console.log('Roles injected successfully!');
    } else {
      console.log('Roles already exist, skipping injection.');
    }
  };

  const checkAndInjectAccounts = async (db, accounts) => {
    const existingAccounts = await db.account.findAll({
      where: {
        id: {
          [db.Sequelize.Op.in]: accounts.map(account => account.id)
        }
      }
    });
  
    if (existingAccounts.length === 0) {
      await db.account.bulkCreate(accounts);
      console.log('Accounts injected successfully!');
    } else {
      console.log('Accounts already exist, skipping injection.');
    }
  };
  
  
  const injectData = async (db, data) => {
    await checkAndInjectUnits(db, data.units);
    await checkAndInjectRoles(db, data.roles);
    await checkAndInjectAccounts(db, data.account_list);

  };
  
  module.exports = injectData;
  