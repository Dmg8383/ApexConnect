const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'whatsapp',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function migrate() {
  try {
    console.log('Running call recording migration...');
    const client = await pool.connect();
    
    await client.query(`
      ALTER TABLE calls 
      ADD COLUMN IF NOT EXISTS recording_url TEXT;
    `);

    console.log('✅ Migration successful: recording_url column added to calls table.');
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
