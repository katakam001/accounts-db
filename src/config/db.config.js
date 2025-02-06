module.exports = {
  HOST: "DB_HOST",
  USER: "postgres",
  PASSWORD: "DB_PASSWORD",
  DB: "account_db",
  dialect: "postgres",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};
