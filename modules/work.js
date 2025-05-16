module.exports = {
  name: 'work',
  description: 'Làm việc để kiếm điểm',
  usage: '!work',
  examples: [
    '!work - Làm việc để kiếm điểm'
  ],
  aliases: ['làm', 'job'],
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

      // Kiểm tra cooldown
      const lastWork = await new Promise((resolve, reject) => {
        db.get('SELECT last_work FROM users WHERE user_id = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (lastWork && lastWork.last_work) {
        const lastWorkTime = new Date(lastWork.last_work).getTime();
        const now = Date.now();
        const cooldownTime = 5 * 60 * 1000; // 10 phút
        const timeLeft = cooldownTime - (now - lastWorkTime);

        if (timeLeft > 0) {
          const minutes = Math.floor(timeLeft / 60000);
          const seconds = Math.floor((timeLeft % 60000) / 1000);
          
          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: `⏰ Bạn đã làm công việc hôm nay, để tránh kiệt sức hãy quay lại sau: ${minutes} phút ${seconds} giây.` 
              })
            }
          });
          return;
        }
      }

      // Danh sách công việc
      const jobs = [
        "bán vé số",
        "sửa xe",
        "lập trình",
        "hack facebook",
        "đầu bếp",
        "thợ hồ",
        "fake taxi",
        "gangbang người nào đó",
        "thợ sửa ống nước may mắn  ( ͡° ͜ʖ ͡°)",
        "streamer",
        "bán hàng trực tuyến",
        "nội trợ",
        'bán "hoa"',
        "tìm jav/hentai code cho SpermLord",
        "chơi Yasuo và gánh đội của bạn"
      ];

      // Chọn công việc ngẫu nhiên
      const randomJob = jobs[Math.floor(Math.random() * jobs.length)];
      
      // Tính tiền thưởng (100-500 điểm)
      const reward = Math.floor(Math.random() * 401) + 100;

      // Cập nhật database với timestamp hiện tại
      const now = new Date().toISOString();
      await new Promise((resolve, reject) => {
        db.run(`
          UPDATE users 
          SET money = money + ?, 
              last_work = ? 
          WHERE user_id = ?
        `, [reward, now, userId], (err) => {
          if (err) reject(err);
          else resolve();
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
            text: `💼 Bạn đã làm công việc "${randomJob}" và kiếm ra được ${reward} điểm!` 
          })
        }
      });

    } catch (error) {
      console.error('Error in work command:', error);
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
            text: '❌ Có lỗi xảy ra khi làm việc!' 
          })
        }
      });
    }
  }
}; 