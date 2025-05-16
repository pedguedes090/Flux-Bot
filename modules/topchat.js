const sqlite3 = require('sqlite3').verbose();
const path = require('path');

module.exports = {
  name: 'topchat',
  description: 'Xem bảng xếp hạng chat',
  usage: '!topchat',
  examples: [
    '!topchat - Xem top 10 người chơi chat nhiều nhất'
  ],
  aliases: ['topchat'],
  async execute(client, event, args, db) {
    const chatId = event.event?.message?.chat_id || event.message?.chat_id;
    if (!chatId) {
      console.error('No chat_id found in event');
      return;
    }

    try {
      // Lấy top 10 người chơi chat nhiều nhất
      const topUsers = await new Promise((resolve, reject) => {
        db.all('SELECT username, message_count FROM users ORDER BY message_count DESC LIMIT 10', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      if (!topUsers || topUsers.length === 0) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Chưa có dữ liệu xếp hạng!' 
            })
          }
        });
        return;
      }

      // Tạo bảng xếp hạng
      let leaderboard = '💬 BẢNG XẾP HẠNG CHAT 💬\n\n';
      topUsers.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        leaderboard += `${medal} ${user.username}: ${user.message_count.toLocaleString()} tin nhắn\n`;
      });

      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ 
            text: leaderboard 
          })
        }
      });

    } catch (error) {
      console.error('Error in topchat command:', error);
      if (error.response?.data) {
        console.error('API Error:', error.response.data);
      }
      
      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ 
            text: '❌ Có lỗi xảy ra khi xem bảng xếp hạng!' 
          })
        }
      });
    }
  }
}; 