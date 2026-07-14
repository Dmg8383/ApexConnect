const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log('Dumping schema...');
  const dbUrl = 'postgresql://postgres:Meet%238594@localhost:5432/wapuser';
  const pgDumpPath = '"C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe"';
  
  execSync(`${pgDumpPath} --schema-only -d "${dbUrl}" -f schema_dump.sql`, { stdio: 'inherit', shell: 'cmd.exe' });
  console.log('Schema dumped successfully to schema_dump.sql');
} catch (e) {
  console.error('Failed using standard path. Trying from PATH...');
  try {
    const dbUrl = 'postgresql://postgres:Meet%238594@localhost:5432/wapuser';
    execSync(`pg_dump --schema-only -d "${dbUrl}" -f schema_dump.sql`, { stdio: 'inherit', shell: 'cmd.exe' });
    console.log('Schema dumped successfully to schema_dump.sql');
  } catch (e2) {
    console.error('Completely failed to dump schema.', e2.message);
  }
}
