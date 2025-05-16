const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Emoji cho xúc xắc
const DICE_EMOJIS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// Hiệu ứng loading
const LOADING_FRAMES = ['🎲', '🎯', '🎮', '🎰', '🎲', '🎯'];

module.exports = {
  name: 'taixiu',
  description: 'Chơi tài xỉu với xúc xắc',
  usage: '!taixiu [tài/xỉu] [số tiền]',
  examples: [
    '!taixiu tài 1000 - Cược 1000 điểm vào tài',
    '!taixiu xỉu 2000 - Cược 2000 điểm vào xỉu'
  ],
  aliases: ['tx'],
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
              text: '❌ Thiếu tham số!\n💡 Sử dụng: !taixiu [tài/xỉu] [số tiền]' 
            })
          }
        });
        return;
      }

      // Kiểm tra số tiền
      const betAmount = parseInt(args[1]);
      if (isNaN(betAmount) || betAmount <= 0) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Số tiền cược không hợp lệ!\n💡 Số tiền phải là số dương.' 
            })
          }
        });
        return;
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
            content: JSON.stringify({ 
              text: '❌ Không tìm thấy thông tin người chơi trong database!' 
            })
          }
        });
        return;
      }

      if (betAmount > user.money) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: `❌ Số tiền cược lớn hơn số dư!\n💳 Số dư hiện tại: ${user.money} điểm` 
            })
          }
        });
        return;
      }

      if (betAmount < 1000) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Số tiền cược tối thiểu là 1000 điểm!' 
            })
          }
        });
        return;
      }

      // Kiểm tra lựa chọn tài/xỉu
      const choice = args[0].toLowerCase();
      if (choice !== 'tài' && choice !== 'xỉu') {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Lựa chọn không hợp lệ!\n💡 Chọn tài hoặc xỉu.' 
            })
          }
        });
        return;
      }

      // Gửi thông báo bắt đầu
      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ 
            text: `🎲 Bắt đầu lắc xúc xắc...\n💰 Tiền cược: ${betAmount} điểm\n🎯 Lựa chọn: ${choice.toUpperCase()}` 
          })
        }
      });

      // Hiệu ứng loading
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: `${LOADING_FRAMES[i]} Đang lắc...` 
            })
          }
        });
      }

      // Lắc xúc xắc
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const dice3 = Math.floor(Math.random() * 6) + 1;
      const total = dice1 + dice2 + dice3;
      const result = total >= 11 ? 'tài' : 'xỉu';

      // Tính tiền thưởng
      const isWin = choice === result;
      const reward = isWin ? betAmount : -betAmount;

      // Cập nhật số dư
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET money = money + ? WHERE user_id = ?', [reward, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Tạo thông báo kết quả
      let message = `🎲 Kết quả:\n`;
      message += `${DICE_EMOJIS[dice1-1]} ${DICE_EMOJIS[dice2-1]} ${DICE_EMOJIS[dice3-1]}\n`;
      message += `📊 Tổng điểm: ${total} (${result.toUpperCase()})\n`;
      
      if (isWin) {
        message += `🎉 Thắng ${betAmount} điểm!\n`;
        message += `💳 Số dư mới: ${user.money + betAmount} điểm`;
      } else {
        message += `😢 Thua ${betAmount} điểm!\n`;
        message += `💳 Số dư mới: ${user.money - betAmount} điểm`;
      }

      // Gửi kết quả
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
      console.error('Error in taixiu command:', error);
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
            text: '❌ Có lỗi xảy ra khi chơi tài xỉu!' 
          })
        }
      });
    }
  }
}; 