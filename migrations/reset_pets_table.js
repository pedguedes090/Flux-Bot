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

// Drop old table
db.run('DROP TABLE IF EXISTS user_pets', (err) => {
  if (err) {
    console.error('Error dropping table:', err);
  } else {
    console.log('Dropped old user_pets table');
  }
});

// Create new user_pets table with auto-incrementing ID
db.run(`
  CREATE TABLE IF NOT EXISTS user_pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    pet_type TEXT NOT NULL,
    name TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating user_pets table:', err);
  } else {
    console.log('Created new user_pets table successfully');
    
    // Create indexes after table is created
    db.run('CREATE INDEX IF NOT EXISTS idx_user_pets_user_id ON user_pets(user_id)', (err) => {
      if (err) {
        console.error('Error creating index on user_id:', err);
      } else {
        console.log('Created index on user_id successfully');
      }
    });

    db.run('CREATE INDEX IF NOT EXISTS idx_user_pets_pet_type ON user_pets(pet_type)', (err) => {
      if (err) {
        console.error('Error creating index on pet_type:', err);
      } else {
        console.log('Created index on pet_type successfully');
      }
    });
  }
});

// Đóng kết nối database sau khi tất cả các thao tác hoàn thành
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
  });
}, 1000); // Đợi 1 giây để đảm bảo các thao tác bất đồng bộ hoàn thành 