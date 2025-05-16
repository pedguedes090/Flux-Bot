const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'reload',
  description: 'Tải lại các module của bot',
  usage: '!reload [tên module]',
  examples: [
    '!reload - Tải lại tất cả các module',
    '!reload slot - Tải lại module slot'
  ],
  aliases: ['r'],
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

      // Kiểm tra quyền admin
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT is_admin FROM users WHERE user_id = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      console.log('Debug - User data:', { userId, user, isAdmin: user?.is_admin });
      
      if (!user || user.is_admin !== 1) {
        console.log('Debug - Admin check failed:', { 
          userExists: !!user, 
          isAdminValue: user?.is_admin,
          isAdminType: typeof user?.is_admin 
        });
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text: '❌ Bạn không có quyền sử dụng lệnh này!' })
          }
        });
        return;
      }

      const modulesPath = path.join(__dirname);
      let reloadedModules = [];

      if (args.length > 0) {
        // Tải lại module cụ thể
        const moduleName = args[0].toLowerCase();
        const modulePath = path.join(modulesPath, `${moduleName}.js`);

        if (!fs.existsSync(modulePath)) {
          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ text: `❌ Không tìm thấy module "${moduleName}"!` })
            }
          });
          return;
        }

        try {
          // Xóa module khỏi cache
          delete require.cache[require.resolve(modulePath)];
          // Tải lại module
          const module = require(modulePath);
          // Cập nhật module trong commands map
          if (client.commands) {
            client.commands.set(module.name, module);
          } else {
            console.error('Commands map not found in client object');
            return;
          }
          reloadedModules.push(module.name);
        } catch (error) {
          console.error(`Error reloading module ${moduleName}:`, error);
          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ text: `❌ Lỗi khi tải lại module "${moduleName}": ${error.message}` })
            }
          });
          return;
        }
      } else {
        // Tải lại tất cả các module
        fs.readdirSync(modulesPath).forEach(file => {
          if (file.endsWith('.js')) {
            const modulePath = path.join(modulesPath, file);
            try {
              // Xóa module khỏi cache
              delete require.cache[require.resolve(modulePath)];
              // Tải lại module
              const module = require(modulePath);
              // Cập nhật module trong commands map
              if (client.commands) {
                client.commands.set(module.name, module);
              } else {
                console.error('Commands map not found in client object');
                return;
              }
              reloadedModules.push(module.name);
            } catch (error) {
              console.error(`Error reloading module ${file}:`, error);
            }
          }
        });
      }

      // Thông báo kết quả
      let resultText = '🔄 **Kết quả tải lại module:**\n\n';
      if (reloadedModules.length > 0) {
        resultText += '✅ Đã tải lại thành công:\n';
        reloadedModules.forEach(name => {
          resultText += `• ${name}\n`;
        });
      } else {
        resultText += '❌ Không có module nào được tải lại!';
      }

      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text: resultText })
        }
      });

    } catch (error) {
      console.error('Error in reload command:', error);
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
          content: JSON.stringify({ text: '❌ Có lỗi xảy ra khi tải lại module!' })
        }
      });
    }
  }
}; 