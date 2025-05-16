const fs = require('fs');
const path = require('path');
const https = require('https');

// Tải ảnh nếu chưa có
async function downloadImage(url, filepath) {
  if (!fs.existsSync(filepath)) {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode === 200) {
          const writeStream = fs.createWriteStream(filepath);
          response.pipe(writeStream);
          writeStream.on('finish', () => {
            writeStream.close();
            resolve();
          });
        } else {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
        }
      }).on('error', reject);
    });
  }
}

// Tải tất cả ảnh cần thiết
async function downloadAllImages() {
  const cacheDir = path.join(__dirname, '../cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }

  const images = {
    'ga.jpg': 'https://i.imgur.com/jPdZ1Q8.jpg',
    'tom.jpg': 'https://i.imgur.com/4214Xx9.jpg',
    'bau.jpg': 'https://i.imgur.com/4KLd4EE.jpg',
    'cua.jpg': 'https://i.imgur.com/s8YAaxx.jpg',
    'ca.jpg': 'https://i.imgur.com/YbFzAOU.jpg',
    'nai.jpg': 'https://i.imgur.com/UYhUZf8.jpg',
    'baucua.gif': 'https://i.imgur.com/dlrQjRL.gif'
  };

  for (const [filename, url] of Object.entries(images)) {
    await downloadImage(url, path.join(cacheDir, filename));
  }
}

// Chuyển đổi tên thành emoji
function getEmoji(name) {
  const emojis = {
    'ga': '🐓',
    'tom': '🦞',
    'bau': '🍐',
    'cua': '🦀',
    'ca': '🐟',
    'nai': '🦌'
  };
  return emojis[name] || name;
}

// Lấy kết quả ngẫu nhiên
function getRandomResult() {
  const items = ['ga', 'tom', 'bau', 'cua', 'ca', 'nai'];
  const result = [];
  for (let i = 0; i < 3; i++) {
    result.push(items[Math.floor(Math.random() * items.length)]);
  }
  return result;
}

module.exports = {
  name: 'baucua',
  description: 'Chơi bầu cua tôm cá',
  usage: '!baucua [bầu/cua/cá/nai/gà/tôm] [số tiền]',
  examples: [
    '!baucua bầu 1000 - Cược 1000 điểm vào bầu',
    '!baucua cua 2000 - Cược 2000 điểm vào cua'
  ],
  aliases: ['bc', 'bau'],
  async execute(client, event, args, db) {
    const chatId = event.event?.message?.chat_id || event.message?.chat_id;
    if (!chatId) {
      console.error('No chat_id found in event');
      return;
    }

    try {
      // Tải ảnh nếu chưa có
      await downloadAllImages();

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
              text: '❌ Thiếu tham số!\n💡 Sử dụng: !baucua [bầu/cua/cá/nai/gà/tôm] [số tiền]' 
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

      // Chuyển đổi tên con vật
      const betItem = args[0].toLowerCase();
      const itemMap = {
        'bầu': 'bau',
        'cua': 'cua',
        'cá': 'ca',
        'nai': 'nai',
        'gà': 'ga',
        'tôm': 'tom'
      };

      const item = itemMap[betItem];
      if (!item) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Con vật không hợp lệ!\n💡 Sử dụng: !baucua [bầu/cua/cá/nai/gà/tôm] [số tiền]' 
            })
          }
        });
        return;
      }

      // Gửi ảnh lắc
      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ 
            text: '🎲 Đang lắc...' 
          })
        }
      });

      // Đợi 5 giây
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Lấy kết quả
      const result = getRandomResult();
      const emojis = result.map(getEmoji);

      // Tính tiền thưởng
      const count = result.filter(r => r === item).length;
      let reward = 0;
      let message = '';

      if (count > 0) {
        if (count === 1) {
          reward = betAmount + 300;
          message = `🎉 Kết quả: ${emojis.join(' | ')}\n💰 Thắng ${reward} điểm (1 ${getEmoji(item)})`;
        } else if (count === 2) {
          reward = betAmount * 2;
          message = `🎉 Kết quả: ${emojis.join(' | ')}\n💰 Thắng ${reward} điểm (2 ${getEmoji(item)})`;
        } else if (count === 3) {
          reward = betAmount * 3;
          message = `🎉 Kết quả: ${emojis.join(' | ')}\n💰 Thắng ${reward} điểm (3 ${getEmoji(item)})`;
        }
      } else {
        reward = -betAmount;
        message = `😢 Kết quả: ${emojis.join(' | ')}\n💸 Thua ${betAmount} điểm (0 ${getEmoji(item)})`;
      }

      // Cập nhật số dư
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET money = money + ? WHERE user_id = ?', [reward, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

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
      console.error('Error in baucua command:', error);
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
            text: '❌ Có lỗi xảy ra khi chơi bầu cua!' 
          })
        }
      });
    }
  }
}; 