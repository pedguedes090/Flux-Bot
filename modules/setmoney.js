const sqlite3 = require('sqlite3').verbose();
const path = require('path');

module.exports = {
  name: 'setmoney',
  description: 'Đặt số tiền cho người chơi (Admin only)',
  usage: '!setmoney [số tiền] [user_id]',
  examples: [
    '!setmoney 1000 - Đặt số tiền của bản thân thành 1000 điểm',
    '!setmoney 1000 user_id - Đặt số tiền của người chơi khác thành 1000 điểm'
  ],
  aliases: ['set'],
  async execute(client, event, args, db) {
    const chatId = event.event?.message?.chat_id || event.message?.chat_id;
    if (!chatId) {
      console.error('No chat_id found in event');
      return;
    }

    try {
      // Lấy thông tin người dùng
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
              text: '❌ Không tìm thấy thông tin người dùng!' 
            })
          }
        });
        return;
      }

      // Kiểm tra quyền admin
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT is_admin FROM users WHERE user_id = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!user || !user.is_admin) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Bạn không có quyền sử dụng lệnh này!' 
            })
          }
        });
        return;
      }

      // Kiểm tra tham số
      if (args.length < 1) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Thiếu tham số!\n💡 Sử dụng: !setmoney [số tiền] [user_id]' 
            })
          }
        });
        return;
      }

      // Kiểm tra số tiền
      const amount = parseInt(args[0]);
      if (isNaN(amount) || amount < 0) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Số tiền không hợp lệ!\n💡 Số tiền phải là số không âm.' 
            })
          }
        });
        return;
      }

      // Xác định người nhận
      const targetId = args[1] || userId;

      // Kiểm tra người nhận có tồn tại
      const target = await new Promise((resolve, reject) => {
        db.get('SELECT money, username FROM users WHERE user_id = ?', [targetId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!target) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Không tìm thấy người chơi!' 
            })
          }
        });
        return;
      }

      // Đặt số tiền
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET money = ? WHERE user_id = ?', [amount, targetId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Gửi thông báo
      const message = targetId === userId 
        ? `💰 Đã đặt số tiền của bạn thành ${amount} điểm!`
        : `💰 Đã đặt số tiền của ${target.username} thành ${amount} điểm!`;

      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ 
            text: message 
          })
        }
      });

    } catch (error) {
      console.error('Error in setmoney command:', error);
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
            text: '❌ Có lỗi xảy ra khi đặt số tiền!' 
          })
        }
      });
    }
  }
}; 