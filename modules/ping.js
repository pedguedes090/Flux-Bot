module.exports = {
  name: 'ping',
  description: 'Kiểm tra độ trễ của bot',
  usage: '!ping',
  examples: [
    '!ping - Kiểm tra độ trễ của bot'
  ],
  aliases: ['p'],
  async execute(client, event, args, db) {
    const startTime = Date.now();
    
    await client.im.message.create({
      params: {
        receive_id: event.message.chat_id,
        receive_id_type: 'chat_id'
      },
      data: {
        msg_type: 'text',
        content: JSON.stringify({ text: '🏓 Pong!' })
      }
    });

    const endTime = Date.now();
    const latency = endTime - startTime;

    await client.im.message.create({
      params: {
        receive_id: event.message.chat_id,
        receive_id_type: 'chat_id'
      },
      data: {
        msg_type: 'text',
        content: JSON.stringify({ text: `⏱️ Độ trễ: ${latency}ms` })
      }
    });
  }
}; 