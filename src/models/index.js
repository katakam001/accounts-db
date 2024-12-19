const config = require("../config/db.config.js");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(
  config.DB,
  config.USER,
  config.PASSWORD,
  {
    host: config.HOST,
    dialect: config.dialect,
    logging: console.log,
    pool: {
      max: config.pool.max,
      min: config.pool.min,
      acquire: config.pool.acquire,
      idle: config.pool.idle
    }
  }
);

const db = {};


db.Sequelize = Sequelize;
db.sequelize = sequelize;


db.user = require("../models/user.model.js")(sequelize, Sequelize);
db.role = require("../models/role.model.js")(sequelize, Sequelize);
db.account = require("../models/account.model.js")(sequelize, Sequelize);
db.group = require("../models/group.model.js")(sequelize, Sequelize);
db.accountGroup=require("../models/accountGroup.model.js")(sequelize, Sequelize,db.account,db.group);
db.cash = require("../models/cashEntry.model.js")(sequelize, Sequelize, db.account);
db.journalEntry = require("../models/journalEntry.js")(sequelize, Sequelize);
db.journalItem = require("../models/journalItem.js")(sequelize, Sequelize, db.account, db.group, db.journalEntry);
db.purchaseCategories = require("../models/purchaseCategories.model.js")(sequelize, Sequelize);
db.purchaseFields = require("../models/purchaseFields.model.js")(sequelize, Sequelize,db.purchaseCategories);
db.units = require("../models/units.model.js")(sequelize, Sequelize);
db.categoryUnits = require("../models/categoryUnit.model.js")(sequelize, Sequelize,db.purchaseCategories,db.units);
db.purchaseEntry = require("../models/purchaseEntry.model.js")(sequelize, Sequelize,db.purchaseCategories,db.account,db.units,db.journalEntry);
db.purchaseEntryField = require("../models/purchaseEntryField.model.js")(sequelize, Sequelize,db.purchaseEntry);

db.role.belongsToMany(db.user, {
  through: "user_roles"
});
db.user.belongsToMany(db.role, {
  through: "user_roles"
});

db.journalEntry.hasMany(db.journalItem, { as: 'items', foreignKey: 'journal_id' });

db.journalItem.belongsTo(db.journalEntry, { foreignKey: 'journal_id' });
db.journalItem.belongsTo(db.account, { as: 'account', foreignKey: 'account_id' });
db.journalItem.belongsTo(db.group, { as: 'group', foreignKey: 'group_id' });
db.account.belongsToMany(db.group, {through: 'account_group',as: 'groups',foreignKey: 'account_id'});
db.group.belongsToMany(db.account, {through: 'account_group',as: 'accounts',foreignKey: 'group_id'});

db.journalEntry.belongsTo(db.user, { as: 'user', foreignKey: 'user_id' });
db.account.hasMany(db.cash, { foreignKey: 'account_id' });
db.cash.belongsTo(db.account, { foreignKey: 'account_id' });
db.purchaseCategories.hasMany(db.purchaseFields, { foreignKey: 'category_id', as: 'fields' });
db.purchaseFields.belongsTo(db.purchaseCategories, { foreignKey: 'category_id', as: 'category' });
db.units.belongsToMany(db.purchaseCategories, { through: 'category_units', foreignKey: 'unit_id', as: 'categories' });
db.units.hasMany(db.purchaseEntry, { foreignKey: 'unit_id', as: 'purchaseEntries' });
db.purchaseCategories.belongsToMany(db.units, { through: 'category_units', foreignKey: 'category_id', as: 'units' });
db.purchaseCategories.hasMany(db.purchaseEntry, {foreignKey: 'category_id',as: 'entries'});
db.categoryUnits.belongsTo(db.purchaseCategories, { foreignKey: 'category_id', as: 'category' });
db.categoryUnits.belongsTo(db.units, { foreignKey: 'unit_id', as: 'unit' });

db.purchaseEntryField.belongsTo(db.purchaseEntry, { foreignKey: 'entry_id', as: 'entry' });
db.account.hasMany(db.purchaseEntry, { foreignKey: 'account_id', as: 'purchaseEntries' });
db.ROLES = ["user", "admin", "moderator"];
db.purchaseEntry.belongsTo(db.journalEntry, { foreignKey: 'journal_id', as: 'journal' });
db.purchaseEntry.belongsTo(db.account, { foreignKey: 'account_id', as: 'account' });
db.purchaseEntry.belongsTo(db.units, {foreignKey: 'unit_id',as: 'unit',});
db.purchaseEntry.belongsTo(db.purchaseCategories, { foreignKey: 'category_id', as: 'category' });
db.purchaseEntry.hasMany(db.purchaseEntryField, { foreignKey: 'entry_id', as: 'fields' });

module.exports = db;
