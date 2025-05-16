const symbols = ['🍎', '🍋', '🍇', '🍒', '🍊', '💎', '7️⃣', '🎰'];

module.exports = {
  name: 'slot',
  description: 'Chơi slot machine',
  usage: '!slot [số điểm]',
  examples: [
    '!slot - Chơi với 100 điểm mặc định',
    '!slot 500 - Chơi với 500 điểm'
  ],
  aliases: ['s'],
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
        console.error('No user_id found in event');
        return;
      }

      // Lấy số điểm đặt cược
      let betAmount = 100; // Mặc định 100 điểm
      if (args.length > 0) {
        const parsedBet = parseInt(args[0]);
        if (isNaN(parsedBet) || parsedBet < 10) {
          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ text: '❌ Số điểm đặt cược phải lớn hơn hoặc bằng 10!' })
            }
          });
          return;
        }
        betAmount = parsedBet;
      }

      // Kiểm tra số dư
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT money FROM users WHERE user_id = ?', [userId], (err, row) => {
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

      if (user.money < betAmount) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text: `❌ Bạn không đủ điểm! Số dư: ${user.money} điểm` })
          }
        });
        return;
      }

      // Quay slot
      const results = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ];

      // Tính toán kết quả
      let multiplier = 0;
      let resultText = '';

      if (results[0] === results[1] && results[1] === results[2]) {
        // Ba biểu tượng giống nhau
        switch (results[0]) {
          case '💎':
            multiplier = 10;
            break;
          case '7️⃣':
            multiplier = 7;
            break;
          case '🎰':
            multiplier = 5;
            break;
          default:
            multiplier = 3;
        }
        resultText = `🎉 JACKPOT! Ba ${results[0]}!`;
      } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
        // Hai biểu tượng giống nhau
        multiplier = 1.9;
        resultText = '🎯 Hai biểu tượng giống nhau!';
      } else {
        // Không trùng
        multiplier = 0;
        resultText = '😢 Chúc may mắn lần sau!';
      }

      // Tính toán số điểm thắng/thua
      const winAmount = Math.floor(betAmount * multiplier);
      const finalAmount = winAmount - betAmount;

      // Cập nhật số dư
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET money = money + ? WHERE user_id = ?', [finalAmount, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Lấy số dư mới
      const newBalance = await new Promise((resolve, reject) => {
        db.get('SELECT money FROM users WHERE user_id = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row.money);
        });
      });

      // Hiển thị kết quả
      const resultMessage = [
        '🎰 **Kết quả Slot Machine** 🎰\n',
        `[ ${results.join(' | ')} ]\n`,
        resultText,
        `\n💰 Đặt cược: ${betAmount} điểm`,
        multiplier > 0 ? `\n✨ Hệ số: x${multiplier}` : '',
        `\n💵 ${finalAmount >= 0 ? 'Thắng' : 'Thua'}: ${Math.abs(finalAmount)} điểm`,
        `\n💳 Số dư: ${newBalance} điểm`
      ].join('');

      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text: resultMessage })
        }
      });

    } catch (error) {
      console.error('Error in slot command:', error);
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
          content: JSON.stringify({ text: '❌ Có lỗi xảy ra khi chơi slot!' })
        }
      });
    }
  }
}; 