const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Kết nối database
const db = new sqlite3.Database(path.join(__dirname, '../database/bot.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Thêm cột last_daily vào bảng users
db.run(`
  ALTER TABLE users 
  ADD COLUMN last_daily DATETIME DEFAULT NULL
`, (err) => {
  if (err) {
    console.error('Error adding last_daily column:', err);
  } else {
    console.log('Successfully added last_daily column');
  }
  
  // Đóng kết nối
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
  });
}); 