const { Client } = require('@larksuiteoapi/node-sdk');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Khởi tạo client
const client = new Client({
  appId: process.env.APP_ID,
  appSecret: process.env.APP_SECRET,
  disableTokenCache: false
});

// Kết nối database
const db = new sqlite3.Database('bot.db');

// Load các module lệnh
const commands = new Map();
const commandFiles = fs.readdirSync('./modules').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./modules/${file}`);
  commands.set(command.name, command);
  if (command.aliases) {
    for (const alias of command.aliases) {
      commands.set(alias, command);
    }
  }
}

// Lưu trữ tin nhắn đã xử lý
const processedMessages = new Set();

// Hàm xử lý tin nhắn
async function handleMessage(message) {
  const chatId = message.chat_id;
  const content = JSON.parse(message.content.text);
  const text = content.text;
  
  // Kiểm tra prefix
  if (!text.startsWith('!')) return;

  // Tách lệnh và tham số
  const args = text.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  // Tìm lệnh
  const command = commands.get(commandName);
  if (!command) return;

  try {
    // Tạo event object giả lập
    const event = {
      event: {
        message: {
          chat_id: chatId,
          content: message.content
        },
        sender: {
          sender_id: {
            user_id: message.sender.user_id,
            name: message.sender.name
          }
        }
      }
    };

    // Thực thi lệnh
    await command.execute(client, event, args, db);
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
  }
}

// Hàm lấy tin nhắn mới
async function getNewMessages() {
  try {
    // Lấy danh sách chat
    const chats = await client.im.chat.list({
      params: {
        page_size: 100
      }
    });

    for (const chat of chats.data.items) {
      // Lấy tin nhắn mới nhất
      const messages = await client.im.message.list({
        params: {
          receive_id: chat.chat_id,
          receive_id_type: 'chat_id',
          page_size: 20
        }
      });

      // Xử lý từng tin nhắn
      for (const message of messages.data.items) {
        // Bỏ qua tin nhắn đã xử lý
        if (processedMessages.has(message.message_id)) continue;
        
        // Thêm vào danh sách đã xử lý
        processedMessages.add(message.message_id);
        
        // Giới hạn số lượng tin nhắn đã xử lý
        if (processedMessages.size > 1000) {
          const oldestMessage = Array.from(processedMessages)[0];
          processedMessages.delete(oldestMessage);
        }

        // Xử lý tin nhắn
        await handleMessage(message);
      }
    }
  } catch (error) {
    console.error('Error polling messages:', error);
  }
}

// Bắt đầu polling
console.log('Bot đang chạy...');
setInterval(getNewMessages, 5000); // Kiểm tra mỗi 5 giây 