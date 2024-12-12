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
db.journalEntry = require("../models/journalEntry.js")(sequelize, Sequelize);
db.journalItem = require("../models/journalItem.js")(sequelize, Sequelize,db.account,db.group,db.journalEntry);

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


db.journalEntry.belongsTo(db.user, { as: 'user', foreignKey: 'user_id' });

db.ROLES = ["user", "admin", "moderator"];

module.exports = db;
