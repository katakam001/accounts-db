
const Sequelize = require("sequelize");
const moment = require('moment-timezone');
// Access the global dbConfig
global.dbConfig = require('../config/db.config'); 
const dbConfig = global.dbConfig;

const sequelize = global.sequelize || new Sequelize(
  dbConfig.DB,
  dbConfig.USER,
  dbConfig.PASSWORD,
  {
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    logging: (msg) => {
      const timestamp = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
      console.log(`[${timestamp}] ${msg}`);
    },
    pool: {
      max: dbConfig.pool.max,
      min: dbConfig.pool.min,
      acquire: dbConfig.pool.acquire,
      idle: dbConfig.pool.idle
    }
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = require("../models/user.model.js")(sequelize, Sequelize);
db.financial_year_tracking= require("../models/financialYearTracking.model.js")(sequelize, Sequelize);
db.admin_user = require("../models/adminUser.model.js")(sequelize, Sequelize,db.user);
db.role = require("../models/role.model.js")(sequelize, Sequelize);
db.account = require("../models/account.model.js")(sequelize, Sequelize);
db.group = require("../models/group.model.js")(sequelize, Sequelize);
db.accountGroup = require("../models/accountGroup.model.js")(sequelize, Sequelize, db.account, db.group);
db.cash = require("../models/cashEntry.model.js")(sequelize, Sequelize, db.account,db.group);
db.cashEntriesBatch = require("../models/cashEntriesBatch.model.js")(sequelize, Sequelize, db.account,db.group);
db.journalEntry = require("../models/journalEntry.js")(sequelize, Sequelize);
db.journalItem = require("../models/journalItem.js")(sequelize, Sequelize, db.account, db.group, db.journalEntry);
db.categories = require("../models/categories.model.js")(sequelize, Sequelize);
db.fields = require("./fields.model.js")(sequelize, Sequelize);
db.fieldsMapping = require("./fieldsMapping.model.js")(sequelize, Sequelize, db.categories,db.fields,db.account);
db.units = require("../models/units.model.js")(sequelize, Sequelize);
db.categoryUnits = require("../models/categoryUnit.model.js")(sequelize, Sequelize, db.categories, db.units);
db.items=require("../models/item.model.js")(sequelize,Sequelize)
db.entry = require("../models/entry.model.js")(sequelize, Sequelize, db.categories, db.account, db.units, db.journalEntry,db.items);
db.entryField = require("../models/entryField.model.js")(sequelize, Sequelize, db.entry,db.fields);
db.address=require("../models/address.model.js")(sequelize,Sequelize)
db.groupMapping=require("../models/groupMapping.model.js")(sequelize,Sequelize,db.groupMapping,db.group);
db.areas = require("../models/area.model.js")(sequelize, Sequelize);
db.brokers = require("../models/broker.model.js")(sequelize, Sequelize);
db.raw_items=require("../models/rawItem.model.js")(sequelize,Sequelize,db.items,db.units);
db.conversions = require("../models/conversion.model.js")(sequelize, Sequelize,db.units);
db.processed_items = require("../models/processedItems.model.js")(sequelize, Sequelize,db.raw_items,db.items,db.units,db.conversions);
db.production_entries = require("../models/production_entries.model.js")(sequelize, Sequelize,db.items,db.units,db.conversions,db.production_entries);
db.consolidated_stock_register = require("../models/consolidatedStockRegister.model.js")(sequelize, Sequelize);
db.balance = require("../models/balance.model.js")(sequelize, Sequelize);
db.globalBatchOperations = require("../models/globalBatchOperations.model.js")(sequelize, Sequelize);
db.uploadedFileLog = require("../models/uploadedFileLog.model.js")(sequelize, Sequelize);
db.invoice_tracker = require("../models/invoiceTracker.model.js")(sequelize, Sequelize);
db.mapping_rules = require("../models/mapping_rules.js")(sequelize, Sequelize);


db.fieldsMapping.belongsTo(db.categories, { foreignKey: 'category_id', as: 'category' });
db.fieldsMapping.belongsTo(db.fields, { foreignKey: 'field_id', as: 'field' });
db.categories.hasMany(db.fieldsMapping, { foreignKey: 'category_id', as: 'fields' });

db.fields.hasMany(db.entryField, { foreignKey: 'field_id' });
db.fields.hasMany(db.fieldsMapping, { foreignKey: 'field_id' });

db.role.belongsToMany(db.user, {
  through: "user_roles"
});
db.user.belongsToMany(db.role, {
  through: "user_roles"
});

db.user.belongsToMany(db.user, { as: 'Users', through: db.admin_user, foreignKey: 'admin_id' });
db.user.belongsToMany(db.user, { as: 'Admins', through: db.admin_user, foreignKey: 'user_id' });
db.admin_user.belongsTo(db.user, { foreignKey: "user_id", as: "user" });

db.journalEntry.hasMany(db.journalItem, { as: 'items', foreignKey: 'journal_id' });

db.journalItem.belongsTo(db.journalEntry, { foreignKey: 'journal_id' });
db.journalItem.belongsTo(db.account, { as: 'account', foreignKey: 'account_id' });
db.journalItem.belongsTo(db.group, { as: 'group', foreignKey: 'group_id' });

db.journalEntry.belongsTo(db.user, { as: 'user', foreignKey: 'user_id' });
db.account.hasMany(db.cash, { foreignKey: 'account_id' });
db.cash.belongsTo(db.account, { foreignKey: 'account_id' });
db.units.belongsToMany(db.categories, { through: 'category_units', foreignKey: 'unit_id', as: 'categories' });
db.units.hasMany(db.entry, { foreignKey: 'unit_id', as: 'entries' });
db.categories.belongsToMany(db.units, { through: 'category_units', foreignKey: 'category_id', as: 'units' });
db.categories.hasMany(db.entry, { foreignKey: 'category_id', as: 'entries' });
db.categoryUnits.belongsTo(db.categories, { foreignKey: 'category_id', as: 'category' });
db.categoryUnits.belongsTo(db.units, { foreignKey: 'unit_id', as: 'unit' });

db.entryField.belongsTo(db.fields, { foreignKey: 'field_id', as: 'field' });
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
db.entry.belongsTo(db.items, { foreignKey: 'item_id', as: 'item' }); // New association
db.groupMapping.hasMany(db.groupMapping, { as: 'children', foreignKey: 'parent_id' });
db.groupMapping.belongsTo(db.groupMapping, { as: 'parent', foreignKey: 'parent_id' });
db.groupMapping.belongsTo(db.group, { foreignKey: 'group_id' });
db.group.hasMany(db.groupMapping, { foreignKey: 'group_id' });
db.account.belongsToMany(db.group, { through: db.accountGroup, as: 'group', foreignKey: 'account_id' , otherKey: 'group_id'});
db.group.belongsToMany(db.account, { through: db.accountGroup, as: 'accounts', foreignKey: 'group_id', otherKey: 'account_id'});
db.items.hasMany(db.raw_items, { foreignKey: 'item_id', as: 'rawItems' });
db.raw_items.belongsTo(db.items, { foreignKey: 'item_id', as: 'item' });
db.raw_items.belongsTo(db.units, { foreignKey: 'unit_id', as: 'unit' });
db.raw_items.hasMany(db.processed_items, { foreignKey: 'raw_item_id', as: 'processedItems' });
db.processed_items.belongsTo(db.raw_items, { foreignKey: 'raw_item_id', as: 'rawItem' });
db.processed_items.belongsTo(db.items, { foreignKey: 'item_id', as: 'item' });
db.processed_items.belongsTo(db.units, { foreignKey: 'unit_id', as: 'unit' });
db.processed_items.belongsTo(db.conversions, { foreignKey: 'conversion_id', as: 'conversion' });
db.production_entries.belongsTo(db.items, { foreignKey: 'raw_item_id', as: 'rawItem' });
db.production_entries.belongsTo(db.items, { foreignKey: 'item_id', as: 'processedItem' });
db.production_entries.belongsTo(db.units, { foreignKey: 'unit_id', as: 'unit' });
db.production_entries.belongsTo(db.conversions, { foreignKey: 'conversion_id', as: 'conversion' });
db.production_entries.hasMany(db.production_entries, { foreignKey: 'production_entry_id', as: 'processedItems' });


// Conversion associations
db.conversions.belongsTo(db.units, { foreignKey: 'from_unit_id', as: 'fromUnit' });
db.conversions.belongsTo(db.units, { foreignKey: 'to_unit_id', as: 'toUnit' });



module.exports = db;
