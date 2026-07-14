const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  console.log('Starting push_token database migration...');
  
  try {
    // Check if column already exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' and column_name='push_token';
    `;
    
    const result = await pool.query(checkQuery);
    
    if (result.rows.length === 0) {
      console.log('Adding push_token column to users table...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN push_token text;
      `);
      console.log('Successfully added push_token column to users!');
    } else {
      console.log('push_token column already exists.');
    }
    
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
