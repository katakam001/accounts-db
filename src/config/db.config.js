module.exports = {
  HOST: "DB_HOST_PLACEHOLDER",
  USER: "postgres",
  PASSWORD: "DB_PASSWORD_PLACEHOLDER",
  DB: "ajms_db",
  dialect: "postgres",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};
