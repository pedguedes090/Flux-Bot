const sqlite3 = require('sqlite3').verbose();
const path = require('path');

module.exports = {
  name: 'daily',
  description: 'Nhận 10000 điểm mỗi ngày',
  usage: '!daily',
  examples: [
    '!daily - Nhận 10000 điểm mỗi ngày'
  ],
  aliases: ['d'],
  async execute(client, event, args, db) {
    const chatId = event.event?.message?.chat_id || event.message?.chat_id;
    if (!chatId) {
      console.error('No chat_id found in event');
      return;
    }

    try {
      // Lấy thông tin người chơi
      const userId = event.event?.sender?.sender_id?.user_id || event.sender?.sender_id?.user_id;
      if (!userId) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Không tìm thấy thông tin người chơi!' 
            })
          }
        });
        return;
      }

      // Kiểm tra xem người dùng đã nhận daily chưa
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT money, last_daily FROM users WHERE user_id = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!user) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Không tìm thấy thông tin người chơi trong database!' 
            })
          }
        });
        return;
      }

      // Kiểm tra thời gian nhận daily
      const now = new Date();
      const lastDaily = user.last_daily ? new Date(user.last_daily) : null;
      
      if (lastDaily) {
        // Tính thời gian còn lại
        const timeLeft = 24 * 60 * 60 * 1000 - (now - lastDaily);
        if (timeLeft > 0) {
          const hours = Math.floor(timeLeft / (60 * 60 * 1000));
          const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
          
          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: `⏳ Bạn đã nhận daily hôm nay!\n⏰ Còn ${hours} giờ ${minutes} phút nữa mới có thể nhận tiếp.` 
              })
            }
          });
          return;
        }
      }

      // Cập nhật số dư và thời gian nhận daily
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET money = money + 10000, last_daily = CURRENT_TIMESTAMP WHERE user_id = ?',
          [userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Gửi thông báo thành công
      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ 
            text: `🎉 Nhận daily thành công!\n💰 +10000 điểm\n💳 Số dư mới: ${user.money + 10000} điểm` 
          })
        }
      });

    } catch (error) {
      console.error('Error in daily command:', error);
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
            text: '❌ Có lỗi xảy ra khi nhận daily!' 
          })
        }
      });
    }
  }
}; 