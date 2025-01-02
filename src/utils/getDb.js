let db;

const getDb = () => {
  if (!db) {
    db = require("../models");
  }
  return db;
};

const reloadDb = () => {
  delete require.cache[require.resolve("../models")];
  db = require("../models");
};

module.exports = { getDb, reloadDb };
