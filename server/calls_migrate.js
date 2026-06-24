require('dotenv').config();
const pool = require('./db');

async function migrate() {
  try {
    console.log('Running calls migration...');
    
    await pool.query(`
      DROP TABLE IF EXISTS calls CASCADE;

      CREATE TABLE IF NOT EXISTS calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        caller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('audio', 'video')),
        status VARCHAR(20) NOT NULL CHECK (status IN ('missed', 'accepted', 'rejected')),
        duration INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
      CREATE INDEX IF NOT EXISTS idx_calls_receiver_id ON calls(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
    `);
    
    console.log('Calls table migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
