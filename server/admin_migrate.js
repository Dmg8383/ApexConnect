require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Meet%238594@localhost:5432/wapuser',
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Adding is_admin column to users table...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
    `);

    console.log('Creating Admin user...');
    const adminUsername = 'Admin';
    const adminPassword = 'Admin@12345';
    const hash = await bcrypt.hash(adminPassword, 10);
    
    // Check if admin user exists
    const res = await client.query('SELECT * FROM users WHERE username = $1', [adminUsername]);
    
    if (res.rows.length === 0) {
      await client.query(`
        INSERT INTO users (id, display_name, username, password_hash, is_admin)
        VALUES ($1, $2, $3, $4, $5)
      `, ['ADMIN001', 'Super Admin', adminUsername, hash, true]);
      console.log('Admin user created successfully.');
    } else {
      await client.query(`
        UPDATE users SET is_admin = TRUE WHERE username = $1
      `, [adminUsername]);
      console.log('Admin user already exists. Promoted to admin successfully.');
    }
    
    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during migration:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
