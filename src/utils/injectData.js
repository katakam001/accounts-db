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

  
  
  const injectData = async (db, data) => {
    await checkAndInjectRoles(db, data.roles);

  };
  
  module.exports = injectData;
  