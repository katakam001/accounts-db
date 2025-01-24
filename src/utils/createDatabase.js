const { Sequelize } = require('sequelize');
const { Client } = require('pg');
const config = require('../config/db.config.js');

async function createDatabase() {
  const client = new Client({
    user: config.USER,
    host: config.HOST,
    password: config.PASSWORD,
    database: 'template1' // Connect to template1 database
  });

  try {
    await client.connect();
    await client.query(`CREATE DATABASE ${config.DB};`);
    console.log(`Database ${config.DB} created successfully.`);
  } catch (error) {
    if (error.code === '42P04') {
      console.log(`Database ${config.DB} already exists.`);
    } else {
      console.error('Error creating database:', error);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  await createDatabase();

  const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
    host: config.HOST,
    dialect: config.dialect
  });

  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

main();
