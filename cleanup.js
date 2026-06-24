const fs = require('fs');
const path = require('path');

const dirsToDelete = ['.bolt', 'supabase', 'database'];

dirsToDelete.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    console.log(`Deleting ${dir}...`);
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`✅ Successfully deleted ${dir}`);
  } else {
    console.log(`ℹ️  ${dir} is already deleted.`);
  }
});

console.log('Cleanup complete! You can now safely delete this cleanup.js file.');
