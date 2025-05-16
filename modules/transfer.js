module.exports = {
  name: 'transfer',
  description: 'Chuyển tiền cho người khác',
  usage: '!transfer [số tiền] [user_id]',
  examples: [
    '!transfer 100 123456 - Chuyển 100 điểm cho user có ID 123456',
    '!transfer 500 789012 - Chuyển 500 điểm cho user có ID 789012'
  ],
  aliases: ['chuyentien', 'send', 'gift'],
  async execute(client, event, args, db) {
    const chatId = event.event?.message?.chat_id || event.message?.chat_id;
    if (!chatId) {
      console.error('No chat_id found in event');
      return;
    }

    try {
      // Lấy thông tin người gửi từ event
      const senderId = event.event?.sender?.sender_id?.user_id || event.sender?.sender_id?.user_id;
      if (!senderId) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Không tìm thấy thông tin người gửi!' 
            })
          }
        });
        return;
      }

      // Kiểm tra tham số
      if (args.length < 2) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Thiếu tham số!\n💡 Sử dụng: !transfer [số tiền] [user_id]' 
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

      // Lấy thông tin người gửi từ database
      const sender = await new Promise((resolve, reject) => {
        db.get('SELECT user_id, username, money FROM users WHERE user_id = ?', [senderId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!sender) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Không tìm thấy thông tin người gửi trong database!' 
            })
          }
        });
        return;
      }

      // Kiểm tra số dư
      if (sender.money < amount) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: `❌ Số dư không đủ!\n💳 Số dư hiện tại: ${sender.money} điểm` 
            })
          }
        });
        return;
      }

      // Lấy thông tin người nhận từ database
      const receiverId = args[1];
      const receiver = await new Promise((resolve, reject) => {
        db.get('SELECT user_id, username, money FROM users WHERE user_id = ?', [receiverId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!receiver) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Không tìm thấy người nhận!' 
            })
          }
        });
        return;
      }

      // Kiểm tra tự chuyển cho mình
      if (receiver.user_id === sender.user_id) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Không thể chuyển tiền cho chính mình!' 
            })
          }
        });
        return;
      }

      // Thực hiện chuyển tiền
      await new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION');
        
        // Trừ tiền người gửi
        db.run('UPDATE users SET money = money - ? WHERE user_id = ?', [amount, sender.user_id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          // Cộng tiền người nhận
          db.run('UPDATE users SET money = money + ? WHERE user_id = ?', [amount, receiver.user_id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            db.run('COMMIT');
            resolve();
          });
        });
      });

      // Thông báo thành công
      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ 
            text: [
              '✅ Chuyển tiền thành công!',
              `👤 Người gửi: ${sender.username}`,
              `👤 Người nhận: ${receiver.username}`,
              `💵 Số tiền: ${amount} điểm`,
              `💳 Số dư còn lại: ${sender.money - amount} điểm`
            ].join('\n')
          })
        }
      });

    } catch (error) {
      console.error('Error in transfer command:', error);
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
            text: '❌ Có lỗi xảy ra khi chuyển tiền!' 
          })
        }
      });
    }
  }
}; 