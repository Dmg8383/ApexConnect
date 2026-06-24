const db = require('./db');

async function runMigration() {
  console.log('Running OTP Migration...');

  try {
    console.log('Adding phone_number column to users table...');
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE;
    `);

    console.log('Creating otps table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    process.exit();
  }
}

runMigration();
