const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', async (client) => {
  console.log('✅ Connected to PostgreSQL');
  try {
    // Auto-migrate for recording_url
    await client.query(`
      ALTER TABLE calls 
      ADD COLUMN IF NOT EXISTS recording_url TEXT;
    `);
  } catch (err) {
    console.error('Migration error:', err);
  }
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
