const express = require('express');
const events = require('./events');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const port = process.env.PORT || 3000;



const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'account_db',
  password: 'password',
  port: 5432,
});


const app = express()
  .use(cors())
  .use(bodyParser.json())
  .use(events(pool));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });