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
db.accountGroup = require("../models/accountGroup.model.js")(sequelize, Sequelize, db.account, db.group);
db.cash = require("../models/cashEntry.model.js")(sequelize, Sequelize, db.account);
db.journalEntry = require("../models/journalEntry.js")(sequelize, Sequelize);
db.journalItem = require("../models/journalItem.js")(sequelize, Sequelize, db.account, db.group, db.journalEntry);
db.categories = require("../models/categories.model.js")(sequelize, Sequelize);
db.fields = require("../models/fields.model.js")(sequelize, Sequelize, db.categories);
db.units = require("../models/units.model.js")(sequelize, Sequelize);
db.categoryUnits = require("../models/categoryUnit.model.js")(sequelize, Sequelize, db.categories, db.units);
db.entry = require("../models/entry.model.js")(sequelize, Sequelize, db.categories, db.account, db.units, db.journalEntry);
db.entryField = require("../models/entryField.model.js")(sequelize, Sequelize, db.entry);
db.address=require("../models/address.model.js")(sequelize,Sequelize)

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
db.account.belongsToMany(db.group, { through: 'account_group', as: 'groups', foreignKey: 'account_id' });
db.group.belongsToMany(db.account, { through: 'account_group', as: 'accounts', foreignKey: 'group_id' });

db.journalEntry.belongsTo(db.user, { as: 'user', foreignKey: 'user_id' });
db.account.hasMany(db.cash, { foreignKey: 'account_id' });
db.cash.belongsTo(db.account, { foreignKey: 'account_id' });
db.categories.hasMany(db.fields, { foreignKey: 'category_id', as: 'fields' });
db.fields.belongsTo(db.categories, { foreignKey: 'category_id', as: 'category' });
db.units.belongsToMany(db.categories, { through: 'category_units', foreignKey: 'unit_id', as: 'categories' });
db.units.hasMany(db.entry, { foreignKey: 'unit_id', as: 'entries' });
db.categories.belongsToMany(db.units, { through: 'category_units', foreignKey: 'category_id', as: 'units' });
db.categories.hasMany(db.entry, { foreignKey: 'category_id', as: 'entries' });
db.categoryUnits.belongsTo(db.categories, { foreignKey: 'category_id', as: 'category' });
db.categoryUnits.belongsTo(db.units, { foreignKey: 'unit_id', as: 'unit' });

db.entryField.belongsTo(db.entry, { foreignKey: 'entry_id', as: 'entry' });
db.account.hasMany(db.entry, { foreignKey: 'account_id', as: 'entries' });
db.account.hasOne(db.address, {foreignKey: 'account_id',as: 'address',onDelete: 'CASCADE',});
db.address.belongsTo(db.account, {foreignKey: 'account_id',as: 'account',});
db.ROLES = ["user", "admin", "moderator"];
db.entry.belongsTo(db.journalEntry, { foreignKey: 'journal_id', as: 'journal' });
db.entry.belongsTo(db.account, { foreignKey: 'account_id', as: 'account' });
db.entry.belongsTo(db.units, { foreignKey: 'unit_id', as: 'unit' });
db.entry.belongsTo(db.categories, { foreignKey: 'category_id', as: 'category' });
db.entry.hasMany(db.entryField, { foreignKey: 'entry_id', as: 'fields' });

module.exports = db;
