const sqlite3 = require('sqlite3').verbose();
const path = require('path');

module.exports = {
  name: 'addmoney',
  description: 'Thêm tiền cho người chơi (Admin only)',
  usage: '!addmoney [số tiền] [user_id/all]',
  examples: [
    '!addmoney 1000 - Thêm 1000 điểm cho bản thân',
    '!addmoney 1000 user_id - Thêm 1000 điểm cho người chơi khác',
    '!addmoney 1000 all - Thêm 1000 điểm cho tất cả người chơi'
  ],
  aliases: ['add'],
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
              text: '❌ Thiếu tham số!\n💡 Sử dụng: !addmoney [số tiền] [user_id/all]' 
            })
          }
        });
        return;
      }

      // Kiểm tra số tiền
      const amount = parseInt(args[0]);
      if (isNaN(amount) || amount <= 0) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Số tiền không hợp lệ!\n💡 Số tiền phải là số dương.' 
            })
          }
        });
        return;
      }

      // Xác định người nhận tiền
      const targetId = args[1] || userId;

      // Nếu là all thì thêm tiền cho tất cả
      if (targetId.toLowerCase() === 'all') {
        // Lấy số người dùng
        const userCount = await new Promise((resolve, reject) => {
          db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          });
        });

        // Thêm tiền cho tất cả
        await new Promise((resolve, reject) => {
          db.run('UPDATE users SET money = money + ?', [amount], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Gửi thông báo
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: `💰 Đã thêm ${amount} điểm cho ${userCount} người chơi!` 
            })
          }
        });
        return;
      }

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

      // Thêm tiền
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET money = money + ? WHERE user_id = ?', [amount, targetId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Gửi thông báo
      const message = targetId === userId 
        ? `💰 Đã thêm ${amount} điểm cho bạn!\n💳 Số dư mới: ${target.money + amount} điểm`
        : `💰 Đã thêm ${amount} điểm cho ${target.username}!\n💳 Số dư mới: ${target.money + amount} điểm`;

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
      console.error('Error in addmoney command:', error);
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
            text: '❌ Có lỗi xảy ra khi thêm tiền!' 
          })
        }
      });
    }
  }
}; 