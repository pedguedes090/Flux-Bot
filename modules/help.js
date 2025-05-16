const fs = require('fs');
const path = require('path');
const lark = require('@larksuiteoapi/node-sdk');

module.exports = {
  name: 'help',
  description: 'Hiển thị danh sách lệnh hoặc hướng dẫn chi tiết cho một lệnh cụ thể',
  usage: '!help [tên lệnh]',
  examples: [
    '!help - Hiển thị danh sách tất cả các lệnh',
    '!help ping - Hiển thị hướng dẫn chi tiết cho lệnh ping'
  ],
  async execute(client, event, args, db) {
    const modulesPath = path.join(__dirname);
    const commands = new Map();
    
    // Extract chat_id from event
    const chatId = event.event?.message?.chat_id || event.message?.chat_id;
    if (!chatId) {
      console.error('No chat_id found in event:', JSON.stringify(event, null, 2));
      return;
    }

    // Load all commands
    fs.readdirSync(modulesPath).forEach(file => {
      if (file.endsWith('.js')) {
        const command = require(`./${file}`);
        commands.set(command.name, command);
      }
    });

    // If no specific command is requested, show all commands
    if (args.length === 0) {
      let helpText = '📚 **Danh sách lệnh:**\n\n';
      
      // Sort commands alphabetically
      const sortedCommands = Array.from(commands.values()).sort((a, b) => a.name.localeCompare(b.name));
      
      for (const command of sortedCommands) {
        helpText += `**!${command.name}** - ${command.description}\n`;
      }
      
      helpText += '\nSử dụng `!help [tên lệnh]` để xem hướng dẫn chi tiết cho một lệnh cụ thể.';
      
      try {
        console.log('Sending help message to chat:', chatId);
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text: helpText })
          }
        });
      } catch (error) {
        console.error('Error sending help message:', error);
        if (error.response?.data) {
          console.error('API Error:', error.response.data);
        }
      }
      return;
    }

    // Show help for specific command
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (!command) {
      try {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text: `❌ Không tìm thấy lệnh "${commandName}". Sử dụng \`!help\` để xem danh sách lệnh.` })
          }
        });
      } catch (error) {
        console.error('Error sending command not found message:', error);
        if (error.response?.data) {
          console.error('API Error:', error.response.data);
        }
      }
      return;
    }

    let helpText = `📖 **Hướng dẫn sử dụng lệnh !${command.name}**\n\n`;
    helpText += `**Mô tả:** ${command.description}\n\n`;
    helpText += `**Cách sử dụng:** ${command.usage}\n\n`;

    if (command.examples && command.examples.length > 0) {
      helpText += '**Ví dụ:**\n';
      command.examples.forEach(example => {
        helpText += `• ${example}\n`;
      });
    }

    if (command.aliases && command.aliases.length > 0) {
      helpText += '\n**Lệnh tương đương:**\n';
      command.aliases.forEach(alias => {
        helpText += `• !${alias}\n`;
      });
    }

    try {
      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text: helpText })
        }
      });
    } catch (error) {
      console.error('Error sending command help message:', error);
      if (error.response?.data) {
        console.error('API Error:', error.response.data);
      }
    }
  }
}; 