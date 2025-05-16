const sqlite3 = require('sqlite3').verbose();
const path = require('path');

module.exports = {
  name: 'topmoney',
  description: 'Xem bảng xếp hạng tiền',
  usage: '!topmoney',
  examples: [
    '!topmoney - Xem top 10 người chơi có nhiều tiền nhất'
  ],
  aliases: ['top', 'rich'],
  async execute(client, event, args, db) {
    const chatId = event.event?.message?.chat_id || event.message?.chat_id;
    if (!chatId) {
      console.error('No chat_id found in event');
      return;
    }

    try {
      // Lấy top 10 người chơi có nhiều tiền nhất
      const topUsers = await new Promise((resolve, reject) => {
        db.all('SELECT username, money FROM users ORDER BY money DESC LIMIT 10', (err, rows) => {
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
      let leaderboard = '🏆 BẢNG XẾP HẠNG TIỀN 🏆\n\n';
      topUsers.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        leaderboard += `${medal} ${user.username}: ${user.money.toLocaleString()} điểm\n`;
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
      console.error('Error in topmoney command:', error);
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