# Bot Lark

Bot chat tự động cho Lark với các tính năng giải trí và quản lý.

## Cài đặt

1. Clone repository
2. Cài đặt dependencies:
```bash
npm install
```
3. Tạo file `config.json` với nội dung:
```json
{
  "app_id": "your_app_id",
  "app_secret": "your_app_secret",
  "encrypt_key": "your_encrypt_key",
  "verification_token": "your_verification_token",
  "prefix": "!",
  "debug": false
}
```

## Cấu trúc dự án

```
botlark/
├── modules/          # Chứa các lệnh của bot
├── database/         # Chứa file database SQLite
├── logs/            # Chứa log của bot
├── cache/           # Thư mục cache
├── migrations/      # Chứa các file migration database
├── scripts/         # Chứa các script tiện ích
├── config.json      # File cấu hình
├── index.js         # File chính của bot
├── polling.js       # File xử lý polling
├── reset_message_count.js # Script reset message count
└── README.md        # Tài liệu
```

## Cấu trúc Database

### Bảng users
```sql
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  username TEXT,
  message_count INTEGER DEFAULT 0,
  money INTEGER DEFAULT 1000,
  is_admin BOOLEAN DEFAULT FALSE,
  last_work DATETIME DEFAULT NULL,
  last_daily DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Bảng processed_messages
```sql
CREATE TABLE processed_messages (
  message_id TEXT PRIMARY KEY,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## Các hàm tiện ích

### Quản lý thời gian làm việc và nhận thưởng

```javascript
// Cập nhật thời gian làm việc
await client.updateLastWork(userId);

// Cập nhật thời gian nhận thưởng
await client.updateLastDaily(userId);

// Kiểm tra có thể làm việc không (sau 1 giờ)
const canWorkNow = await client.canWork(userId);

// Kiểm tra có thể nhận thưởng không (sau 1 ngày)
const canClaim = await client.canClaimDaily(userId);
```

### Quản lý tin nhắn

```javascript
// Kiểm tra tin nhắn đã xử lý
const isProcessed = await isMessageProcessed(messageId);

// Đánh dấu tin nhắn đã xử lý
await markMessageAsProcessed(messageId);

// Kiểm tra tin nhắn tồn tại
const exists = await verifyMessageExists(client, messageId, chatId);
```

### Quản lý người dùng

```javascript
// Cập nhật thông tin người dùng
await updateUserInfo(client, event, db);

// Kiểm tra số dư
const user = await db.get('SELECT money FROM users WHERE user_id = ?', [userId]);

// Cập nhật số dư
await db.run('UPDATE users SET money = money + ? WHERE user_id = ?', [amount, userId]);
```

## Cache và Performance

- Bot sử dụng cache để lưu trữ tin nhắn với TTL 5 phút
- Database sử dụng WAL mode để tối ưu hiệu suất
- Có cơ chế tự động dọn dẹp tin nhắn đã xử lý sau 1 giờ
- Sử dụng index cho các trường thường xuyên tìm kiếm
- Tự động dọn dẹp tin nhắn đã xử lý sau 1 giờ
- Sử dụng Promise cho các thao tác bất đồng bộ
- Xử lý lỗi chi tiết với try-catch

## Logging

Bot sử dụng hệ thống logging với các cấp độ:
- info: Thông tin thông thường
- success: Thao tác thành công
- warning: Cảnh báo
- error: Lỗi
- command: Thông tin về lệnh

Log được lưu trong thư mục `logs/` với định dạng JSON.

## API Methods

### 1. Gửi tin nhắn
```javascript
await client.im.message.create({
  params: {
    receive_id_type: 'chat_id' // hoặc 'user_id'
  },
  data: {
    receive_id: 'chat_id_hoặc_user_id',
    msg_type: 'text',
    content: JSON.stringify({ text: 'Nội dung tin nhắn' })
  }
});
```

### 2. Trả lời tin nhắn
```javascript
await client.im.message.reply({
  data: {
    content: JSON.stringify({ text: 'Nội dung trả lời' }),
    msg_type: 'text',
    reply_in_thread: true
  }
});
```

### 3. Cập nhật tin nhắn
```javascript
await client.im.message.update({
  data: {
    msg_type: 'text',
    content: JSON.stringify({ text: 'Nội dung mới' })
  }
});
```

### 4. Xóa tin nhắn
```javascript
await client.im.message.delete({
  message_id: 'id_của_tin_nhắn'
});
```

### 5. Gửi ảnh
```javascript
// Upload ảnh
const imageResponse = await client.im.image.create({
  data: {
    image_type: 'message',
    image: fs.readFileSync('đường_dẫn_ảnh')
  }
});

// Gửi tin nhắn với ảnh
await client.im.message.create({
  params: {
    receive_id_type: 'chat_id'
  },
  data: {
    receive_id: 'chat_id',
    msg_type: 'image',
    content: JSON.stringify({
      image_key: imageResponse.data.image_key
    })
  }
});
```

## Các loại tin nhắn hỗ trợ

1. Text (`msg_type: 'text'`)
2. Image (`msg_type: 'image'`)
3. Card (`msg_type: 'interactive'`)
4. File (`msg_type: 'file'`)
5. Audio (`msg_type: 'audio'`)
6. Media (`msg_type: 'media'`)
7. Sticker (`msg_type: 'sticker'`)

## Các loại receive_id_type

1. `chat_id`: Gửi tin nhắn vào nhóm chat
2. `user_id`: Gửi tin nhắn cho người dùng
3. `open_id`: Gửi tin nhắn cho người dùng (Open ID)

## Hệ thống tiền tệ

Bot sử dụng hệ thống tiền tệ ảo với các tính năng:

- Mỗi user mới được tặng 1000 điểm
- Các lệnh game sẽ sử dụng điểm này để đặt cược
- Điểm có thể tăng/giảm thông qua các lệnh game
- Điểm được lưu trong database và không bị mất khi restart bot

### Cách sử dụng trong code

```javascript
// Kiểm tra số dư
const user = await db.get('SELECT money FROM users WHERE user_id = ?', [userId]);

// Cập nhật số dư (thêm điểm)
await db.run('UPDATE users SET money = money + ? WHERE user_id = ?', [amount, userId]);

// Cập nhật số dư (trừ điểm)
await db.run('UPDATE users SET money = money - ? WHERE user_id = ?', [amount, userId]);
```

## Các lệnh

### Lệnh Slot (!slot)
- `!slot` - Chơi với 100 điểm mặc định
- `!slot [số điểm]` - Chơi với số điểm tùy chọn
- `!s` - Lệnh tắt

### Lệnh Reload (!reload)
- `!reload` - Tải lại tất cả các module
- `!reload [tên module]` - Tải lại một module cụ thể
- `!r` - Lệnh tắt

### Lệnh Userinfo (!userinfo)
- `!userinfo` - Xem thông tin của mình
- `!userinfo [@user]` - Xem thông tin người khác
- `!ui` - Lệnh tắt

### Lệnh Help (!help)
- `!help` - Xem tất cả lệnh
- `!help [tên lệnh]` - Xem chi tiết một lệnh
- `!h` - Lệnh tắt

## Phát triển

### Tạo lệnh mới

1. Tạo file mới trong thư mục `modules/`
2. Export một object với các thuộc tính:
   - `name`: Tên lệnh
   - `description`: Mô tả lệnh
   - `usage`: Cách sử dụng
   - `examples`: Ví dụ sử dụng
   - `aliases`: Các lệnh tắt
   - `execute`: Hàm thực thi lệnh

Ví dụ:
```javascript
module.exports = {
  name: 'tên_lệnh',
  description: 'Mô tả lệnh',
  usage: '!tên_lệnh [tham số]',
  examples: ['!tên_lệnh', '!tên_lệnh 100'],
  aliases: ['tl'],
  async execute(client, event, args, db) {
    // Code xử lý lệnh
  }
};
```

### Debug

- Set `debug: true` trong `config.json` để xem log chi tiết
- Log được lưu trong thư mục `logs/`
- Sử dụng `console.log()` để debug

## Xử lý lỗi

Luôn bọc các lệnh gọi API trong try-catch:

```javascript
try {
  await client.im.message.create({
    // ...
  });
} catch (error) {
  console.error('Error:', error);
  if (error.response?.data) {
    console.error('API Error:', error.response.data);
  }
}
```