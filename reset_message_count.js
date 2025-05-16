const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database', 'bot.db'));

// Reset message counts for all users
db.run(`
  UPDATE users 
  SET message_count = (
    SELECT COUNT(DISTINCT pm.message_id)
    FROM processed_messages pm
    WHERE pm.message_id IN (
      SELECT message_id 
      FROM processed_messages 
      WHERE processed_at > (
        SELECT COALESCE(MAX(processed_at), '1970-01-01') 
        FROM processed_messages 
        WHERE message_id IN (
          SELECT message_id 
          FROM processed_messages 
          ORDER BY processed_at DESC 
          LIMIT 1 OFFSET 1
        )
      )
    )
  )
`, (err) => {
  if (err) {
    console.error('Error resetting message counts:', err);
  } else {
    console.log('Message counts have been reset successfully');
  }
  db.close();
}); 