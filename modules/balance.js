module.exports = {
  name: 'balance',
  description: 'Kiểm tra số dư tài khoản',
  usage: '!balance [@user]',
  examples: [
    '!balance - Xem số dư của mình',
    '!balance @user - Xem số dư của người khác'
  ],
  aliases: ['bal', 'money'],
  async execute(client, event, args, db) {
    const chatId = event.event?.message?.chat_id || event.message?.chat_id;
    if (!chatId) {
      console.error('No chat_id found in event');
      return;
    }

    try {
      // Lấy thông tin người dùng
      let userId = event.event?.sender?.sender_id?.user_id || event.sender?.sender_id?.user_id;
      let username = event.event?.sender?.sender_id?.name || event.sender?.sender_id?.name;
      let isSelf = true;

      // Nếu có mention user
      if (args.length > 0) {
        const mentionedUser = args[0];
        if (mentionedUser.startsWith('@')) {
          // TODO: Implement user mention parsing
          // For now, just show error
          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ text: '❌ Tính năng xem số dư người khác đang được phát triển!' })
            }
          });
          return;
        }
      }

      // Kiểm tra số dư
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT money, username FROM users WHERE user_id = ?', [userId], (err, row) => {
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
            content: JSON.stringify({ text: '❌ Không tìm thấy thông tin người dùng!' })
          }
        });
        return;
      }

      // Hiển thị số dư
      const balanceMessage = [
        '💰 **Thông tin tài khoản** 💰\n',
        `👤 Người dùng: ${user.username || username}`,
        `💳 Số dư: ${user.money} điểm`,
        isSelf ? '\n💡 Sử dụng `!slot` để chơi game kiếm điểm!' : ''
      ].join('\n');

      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text: balanceMessage })
        }
      });

    } catch (error) {
      console.error('Error in balance command:', error);
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
          content: JSON.stringify({ text: '❌ Có lỗi xảy ra khi kiểm tra số dư!' })
        }
      });
    }
  }
}; 