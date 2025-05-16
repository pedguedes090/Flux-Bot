module.exports = {
  name: 'userinfo',
  description: 'Hiển thị thông tin người dùng',
  async execute(client, event, args, db) {
    try {
      const userId = event.sender.sender_id.user_id;
      const chatId = event.message.chat_id;

      // Lấy thông tin người dùng từ database
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });

      if (!user) {
        await client.im.message.create({
          params: { receive_id_type: 'chat_id' },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text: '❌ Không tìm thấy thông tin người dùng.' })
          }
        });
        return;
      }

      const infoText = `👤 Thông tin người dùng:\n\n` +
        `ID: ${user.user_id}\n` +
        `Username: ${user.username}\n` +
        `Số tin nhắn: ${user.message_count}\n` +
        `Số tiền: ${user.money} 💰\n` +
        `Ngày tham gia: ${new Date(user.created_at).toLocaleDateString()}`;

      await client.im.message.create({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text: infoText })
        }
      });
    } catch (error) {
      console.error('Error in userinfo command:', error);
      await client.im.message.create({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: event.message.chat_id,
          msg_type: 'text',
          content: JSON.stringify({ text: '❌ Có lỗi xảy ra khi lấy thông tin người dùng.' })
        }
      });
    }
  }
}; 