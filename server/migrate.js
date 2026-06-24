const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();
  await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE, ADD COLUMN IF NOT EXISTS password_hash TEXT');
  console.log('Columns added successfully.');
  await client.end();
}

run().catch(console.error);
