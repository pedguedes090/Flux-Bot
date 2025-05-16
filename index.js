const express = require('express');
const { Client } = require('@larksuiteoapi/node-sdk');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config.json');

const app = express();

// Parse raw body for webhook
app.use('/webhook', express.raw({ type: 'application/json' }));

// Parse JSON for other routes
app.use(express.json());

// Initialize Lark client
const client = new Client({
  appId: config.app_id,
  appSecret: config.app_secret,
  disableTokenCache: false
});

// Create database directory if not exists
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// Initialize database
const db = new sqlite3.Database(path.join(dbDir, 'bot.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    // Enable WAL mode for better concurrency
    db.run('PRAGMA journal_mode = WAL');
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
    // Set busy timeout
    db.run('PRAGMA busy_timeout = 5000');
    
    // Create users table if not exists
    db.run(`CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      message_count INTEGER DEFAULT 0,
      money INTEGER DEFAULT 1000,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_work DATETIME,
      last_daily DATETIME
    )`, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
        return;
      }

      // Create processed_messages table if not exists with index
      db.run(`CREATE TABLE IF NOT EXISTS processed_messages (
        message_id TEXT PRIMARY KEY,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error creating processed_messages table:', err);
          return;
        }

        // Create index after table creation
        db.run('CREATE INDEX IF NOT EXISTS idx_processed_at ON processed_messages(processed_at)', (err) => {
          if (err) {
            console.error('Error creating index:', err);
            return;
          }

          // Clean up old processed messages periodically
          setInterval(() => {
            db.run(`DELETE FROM processed_messages WHERE processed_at < datetime('now', '-1 hour')`);
          }, 60 * 60 * 1000);
        });
      });
    });
  }
});

// Load commands from modules directory
const commands = new Map();
const modulesPath = path.join(__dirname, 'modules');

if (!fs.existsSync(modulesPath)) {
  fs.mkdirSync(modulesPath);
}

fs.readdirSync(modulesPath).forEach(file => {
  if (file.endsWith('.js')) {
    const command = require(`./modules/${file}`);
    commands.set(command.name, command);
  }
});

// Add commands map to client
client.commands = commands;

// AESCipher class for Lark message decryption
class AESCipher {
  constructor(key) {
    const hash = crypto.createHash('sha256');
    hash.update(key);
    this.key = hash.digest();
  }

  decrypt(encrypt) {
    const encryptBuffer = Buffer.from(encrypt, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, encryptBuffer.slice(0, 16));
    let decrypted = decipher.update(encryptBuffer.slice(16).toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// Create logs directory if not exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Function to save log to JSON file
function saveLog(logData) {
  if (!config.debug) return;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logsDir, `webhook-${timestamp}.json`);
  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
  console.log(`Log saved to: ${logFile}`);
}

// Custom logger function with improved formatting
function logger(type, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: '\x1b[36m', // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
    command: '\x1b[35m', // Magenta
    reset: '\x1b[0m', // Reset
    dim: '\x1b[2m', // Dim
    bright: '\x1b[1m' // Bright
  };

  // When debug is false, only show username and message content
  if (!config.debug) {
    if (type === 'info' && data && data.content) {
      // Get username from database
      if (data.userId) {
        db.get('SELECT username FROM users WHERE user_id = ?', [data.userId], (err, row) => {
          if (err) {
            console.log(`${colors.dim}[${timestamp}]${colors.reset} ${colors.error}Unknown${colors.reset}: ${data.content}`);
          } else {
            const username = row ? row.username : 'Unknown';
            console.log(`${colors.dim}[${timestamp}]${colors.reset} ${colors.bright}${username}${colors.reset}: ${data.content}`);
          }
        });
      } else {
        console.log(`${colors.dim}[${timestamp}]${colors.reset} ${colors.error}Unknown${colors.reset}: ${data.content}`);
      }
    }
    return;
  }

  // When debug is true, show everything with better formatting
  const prefix = `${colors.dim}[${timestamp}]${colors.reset} ${colors[type]}[${type.toUpperCase()}]${colors.reset}`;
  
  if (data) {
    if (type === 'command') {
      console.log(`${prefix} ${colors.command}${message}${colors.reset}`, data);
    } else if (type === 'error') {
      console.log(`${prefix} ${colors.error}${message}${colors.reset}`, data);
    } else {
      console.log(`${prefix} ${message}`, data);
    }
  } else {
    if (type === 'command') {
      console.log(`${prefix} ${colors.command}${message}${colors.reset}`);
    } else if (type === 'error') {
      console.log(`${prefix} ${colors.error}${message}${colors.reset}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

// Function to check if message was processed
function isMessageProcessed(messageId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT message_id FROM processed_messages WHERE message_id = ?', [messageId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(!!row);
      }
    });
  });
}

// Function to mark message as processed
function markMessageAsProcessed(messageId) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO processed_messages (message_id) VALUES (?)', [messageId], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Add message cache with improved structure
const messageCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PROCESSED_MESSAGES_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

// Optimize message verification
async function verifyMessageExists(client, messageId, chatId) {
  try {
    // Check cache first
    const cachedMessage = messageCache.get(messageId);
    if (cachedMessage && cachedMessage.timestamp > Date.now() - CACHE_TTL) {
      return true;
    }

    // Try direct message get first
    try {
      const response = await client.im.message.get({
        path: {
          message_id: messageId
        }
      });

      if (response.data?.message) {
        messageCache.set(messageId, {
          timestamp: Date.now(),
          chatId: response.data.message.chat_id
        });
        return true;
      }
    } catch (error) {
      if (config.debug) {
        console.log('Direct message get failed:', error.message);
      }
    }

    // Fallback to message list with smaller page size
    const response = await client.im.message.list({
      params: {
        container_id: chatId,
        container_id_type: 'chat',
        sort_type: 'ByCreateTimeDesc',
        page_size: 10
      }
    });

    const messageExists = response.data?.items?.some(msg => msg.message_id === messageId);
    
    if (messageExists) {
      messageCache.set(messageId, {
        timestamp: Date.now(),
        chatId: chatId
      });
    }

    return messageExists;
  } catch (error) {
    logger('error', 'Error verifying message:', error);
    return false;
  }
}

// Optimize message processing
async function handleMessageEvent(event, client, db) {
  try {
    const message = event.message;
    const content = JSON.parse(message.content);
    const text = content.text;
    const userId = event.sender?.sender_id?.user_id;
    const messageId = message.message_id;
    const chatId = message.chat_id;

    // Log message with better formatting
    logger('info', 'New message received', {
      content: text,
      userId: userId,
      messageId: messageId,
      chatId: chatId
    });

    // Check if message was already processed
    const isProcessed = await new Promise((resolve, reject) => {
      db.get('SELECT 1 FROM processed_messages WHERE message_id = ?', [messageId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (isProcessed) {
      logger('info', 'Message already processed', { messageId });
      return;
    }

    // Mark message as processed first to prevent duplicate processing
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO processed_messages (message_id, processed_at) VALUES (?, CURRENT_TIMESTAMP)', [messageId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Process command if it starts with prefix
    if (text.startsWith(config.prefix)) {
      const args = text.slice(config.prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = commands.get(commandName);

      if (command) {
        logger('command', `Executing command: ${commandName}`, { args });
        try {
          await command.execute(client, event, args, db);
          logger('success', `Command ${commandName} executed successfully`);
        } catch (error) {
          logger('error', `Error executing command ${commandName}:`, error);
          // Send error message to chat
          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: '❌ Có lỗi xảy ra khi thực hiện lệnh!' 
              })
            }
          });
        }
      } else {
        logger('warning', `Command not found: ${commandName}`);
        // Send command not found message
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: `❌ Không tìm thấy lệnh: ${commandName}` 
            })
          }
        });
      }
    }

    // Update user info in background
    if (userId) {
      updateUserInfo(client, event, db).catch(error => {
        logger('error', 'Error updating user info:', error);
      });
    }
  } catch (error) {
    logger('error', 'Error in handleMessageEvent:', error);
    // Send error message to chat
    try {
      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: event.message.chat_id,
          msg_type: 'text',
          content: JSON.stringify({ 
            text: '❌ Có lỗi xảy ra khi xử lý tin nhắn!' 
          })
        }
      });
    } catch (sendError) {
      logger('error', 'Error sending error message:', sendError);
    }
  }
}

// Separate user info update to run in background
async function updateUserInfo(client, event, db) {
  try {
    const userId = event.sender.sender_id.user_id;
    const userInfo = await client.contact.user.get({
      path: {
        user_id: userId,
      },
      params: {
        user_id_type: 'user_id',
        department_id_type: 'open_department_id',
      }
    });

    const username = userInfo.data.user.name;
    
    db.run(
      `INSERT INTO users (user_id, username, message_count) 
       VALUES (?, ?, 1) 
       ON CONFLICT(user_id) DO UPDATE SET 
       username = ?,
       message_count = message_count + 1`,
      [userId, username, username]
    );
  } catch (error) {
    // Fallback to using the name from the message
    const userId = event.sender.sender_id.user_id;
    const username = event.sender.sender_id.name;
    
    db.run(
      `INSERT INTO users (user_id, username, message_count) 
       VALUES (?, ?, 1) 
       ON CONFLICT(user_id) DO UPDATE SET 
       username = ?,
       message_count = message_count + 1`,
      [userId, username, username]
    );
  }
}

// Function to update last work time
async function updateLastWork(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET last_work = CURRENT_TIMESTAMP WHERE user_id = ?',
      [userId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      }
    );
  });
}

// Function to update last daily time
async function updateLastDaily(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET last_daily = CURRENT_TIMESTAMP WHERE user_id = ?',
      [userId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      }
    );
  });
}

// Function to check if user can work
async function canWork(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT last_work FROM users WHERE user_id = ?`,
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (!row || !row.last_work) {
            resolve(true);
          } else {
            const lastWork = new Date(row.last_work);
            const now = new Date();
            const hoursDiff = (now - lastWork) / (1000 * 60 * 60);
            resolve(hoursDiff >= 1); // Có thể làm việc sau 1 giờ
          }
        }
      }
    );
  });
}

// Function to check if user can claim daily
async function canClaimDaily(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT last_daily FROM users WHERE user_id = ?`,
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (!row || !row.last_daily) {
            resolve(true);
          } else {
            const lastDaily = new Date(row.last_daily);
            const now = new Date();
            const daysDiff = (now - lastDaily) / (1000 * 60 * 60 * 24);
            resolve(daysDiff >= 1); // Có thể nhận thưởng sau 1 ngày
          }
        }
      }
    );
  });
}

// Add these functions to the client object
client.updateLastWork = updateLastWork;
client.updateLastDaily = updateLastDaily;
client.canWork = canWork;
client.canClaimDaily = canClaimDaily;

// Optimize webhook handler
app.post('/webhook', async (req, res) => {
  try {
    const rawBody = req.body.toString();
    let body = JSON.parse(rawBody);

    // Log the incoming request
    logger('info', 'Webhook request received', { body });

    // Handle challenge request
    if (body.encrypt) {
      logger('info', 'Processing encrypted message');
      const cipher = new AESCipher(config.encrypt_key);
      const decrypted = cipher.decrypt(body.encrypt);
      const decryptedBody = JSON.parse(decrypted);
      
      logger('info', 'Decrypted body', { decryptedBody });

      // Handle URL verification
      if (decryptedBody.type === 'url_verification') {
        logger('info', 'URL verification request received', { challenge: decryptedBody.challenge });
        return res.json({ challenge: decryptedBody.challenge });
      }

      // Check token in decrypted body
      if (!decryptedBody.header) {
        logger('error', 'No header in decrypted body');
        return res.status(403).json({ error: 'Invalid message format' });
      }

      if (decryptedBody.header.token !== config.verification_token) {
        logger('error', 'Token mismatch', { 
          received: decryptedBody.header.token,
          expected: config.verification_token 
        });
        return res.status(403).json({ error: 'Invalid token' });
      }
      
      event = decryptedBody.event;
    } else {
      // Handle unencrypted URL verification
      if (body.type === 'url_verification') {
        logger('info', 'URL verification request received', { challenge: body.challenge });
        return res.json({ challenge: body.challenge });
      }

      logger('info', 'Processing unencrypted message');
      
      // Check token in raw body
      if (!body.header) {
        logger('error', 'No header in body');
        return res.status(403).json({ error: 'Invalid message format' });
      }

      if (body.header.token !== config.verification_token) {
        logger('error', 'Token mismatch', { 
          received: body.header.token,
          expected: config.verification_token 
        });
        return res.status(500).json({ error: 'Invalid token' });
      }
      
      event = body.event;
    }

    // Process message if exists
    if (event?.message) {
      // Process message asynchronously
      handleMessageEvent(event, client, db).catch(error => {
        logger('error', 'Error handling message:', error);
      });
    }

    // Always respond to webhook immediately
    return res.json({ code: 0, msg: 'success' });
  } catch (error) {
    logger('error', 'Error in webhook handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a test endpoint with better formatting
app.get('/test', (req, res) => {
  logger('info', 'Test endpoint accessed');
  res.json({ status: 'Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger('success', `Server is running on port ${PORT}`);
  logger('info', `Test endpoint: http://localhost:${PORT}/test`);
}); 