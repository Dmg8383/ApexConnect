const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  console.log('Starting group functionality database migration...');
  try {
    const client = await pool.connect();
    
    // Add role column to conversation_participants if it doesn't exist
    await client.query(`
      ALTER TABLE public.conversation_participants
      ADD COLUMN IF NOT EXISTS role character varying(20) DEFAULT 'member';
    `);

    console.log('Successfully added role column to conversation_participants!');

    client.release();
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    pool.end();
  }
}

migrate();
