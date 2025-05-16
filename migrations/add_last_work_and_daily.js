const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Kết nối đến database
const db = new sqlite3.Database(path.join(__dirname, '../database/bot.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
});

// Thêm cột last_work và last_daily
db.run(`
  ALTER TABLE users 
  ADD COLUMN last_work DATETIME DEFAULT NULL;
`, (err) => {
  if (err) {
    console.error('Error adding last_work column:', err);
  } else {
    console.log('Added last_work column successfully');
  }
});

db.run(`
  ALTER TABLE users 
  ADD COLUMN last_daily DATETIME DEFAULT NULL;
`, (err) => {
  if (err) {
    console.error('Error adding last_daily column:', err);
  } else {
    console.log('Added last_daily column successfully');
  }
});

// Đóng kết nối database
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('Database connection closed');
  }
}); 