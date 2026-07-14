const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const client = await pool.connect();
    
    // Get all tables
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const schema = {};
    
    for (let row of tableRes.rows) {
      const tableName = row.table_name;
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      schema[tableName] = colRes.rows;
    }
    
    require('fs').writeFileSync('schema_dump.json', JSON.stringify(schema, null, 2));
    console.log('Schema dumped to schema_dump.json');
    
    client.release();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
