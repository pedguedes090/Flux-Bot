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

// Create user_pets table
db.run(`
  CREATE TABLE IF NOT EXISTS user_pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    pet_id TEXT,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating user_pets table:', err);
  } else {
    console.log('Created user_pets table successfully');
  }
});

// Create user_team table
db.run(`
  CREATE TABLE IF NOT EXISTS user_team (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    pet_id TEXT,
    position INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (pet_id) REFERENCES user_pets(pet_id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating user_team table:', err);
  } else {
    console.log('Created user_team table successfully');
  }
});

// Create user_inventory table
db.run(`
  CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    item_id TEXT,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating user_inventory table:', err);
  } else {
    console.log('Created user_inventory table successfully');
  }
});

// Create user_points table
db.run(`
  CREATE TABLE IF NOT EXISTS user_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    point_id TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  )
`, (err) => {
  if (err) {
    console.error('Error creating user_points table:', err);
  } else {
    console.log('Created user_points table successfully');
  }
});

// Create indexes
db.run('CREATE INDEX IF NOT EXISTS idx_user_pets_user_id ON user_pets(user_id)', (err) => {
  if (err) {
    console.error('Error creating index:', err);
  } else {
    console.log('Created index on user_pets successfully');
  }
});

db.run('CREATE INDEX IF NOT EXISTS idx_user_team_user_id ON user_team(user_id)', (err) => {
  if (err) {
    console.error('Error creating index:', err);
  } else {
    console.log('Created index on user_team successfully');
  }
});

db.run('CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id)', (err) => {
  if (err) {
    console.error('Error creating index:', err);
  } else {
    console.log('Created index on user_inventory successfully');
  }
});

db.run('CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id)', (err) => {
  if (err) {
    console.error('Error creating index:', err);
  } else {
    console.log('Created index on user_points successfully');
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