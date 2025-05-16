const { exec } = require('child_process');
const path = require('path');

// Chạy migration
exec(`node ${path.join(__dirname, '../migrations/add_last_work.js')}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error running migration: ${error}`);
    return;
  }
  if (stderr) {
    console.error(`Migration stderr: ${stderr}`);
    return;
  }
  console.log(`Migration stdout: ${stdout}`);
}); 