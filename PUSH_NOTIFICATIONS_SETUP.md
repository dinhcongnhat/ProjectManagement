# Hướng dẫn cài đặt Push Notifications

## 1. Cài đặt dependencies

### Backend
```bash
cd backend
npm install web-push @types/web-push
```

### Generate VAPID Keys
```bash
cd backend
npx tsx generate-vapid-keys.ts
```

Sau khi chạy, copy keys vào file `.env`:
```env
VAPID_PUBLIC_KEY=your-public-key-here
VAPID_PRIVATE_KEY=your-private-key-here
VAPID_EMAIL=mailto:admin@jtsc.io.vn
```

## 2. Chạy Database Migration

```bash
cd backend
npx prisma migrate dev --name add_push_notifications
# hoặc
npx prisma db push
```

## 3. Khởi động lại Backend

```bash
npm run dev
```

## 4. Cập nhật Frontend VAPID Key

Mở file `frontend/src/context/PushNotificationContext.tsx` và thay `VAPID_PUBLIC_KEY` của bạn vào API response nếu cần.

## 5. Test Push Notifications

1. Mở ứng dụng trên browser/PWA
2. Click vào biểu tượng chuông 🔔 trên header
3. Bật "Thông báo đẩy"
4. Click "Gửi thông báo thử nghiệm"
5. Bạn sẽ nhận được notification trên thiết bị

## Các loại thông báo được hỗ trợ

- **Tin nhắn chat**: Khi có tin nhắn mới trong chat
- **Phân công dự án**: Khi được thêm vào dự án mới  
- **Thảo luận dự án**: Tin nhắn mới trong phần thảo luận
- **Cập nhật dự án**: Thay đổi tiến độ, trạng thái
- **Công việc được giao**: Khi có task mới
- **Được nhắc đến**: Khi có người @mention bạn

## Troubleshooting

### Push không hoạt động trên mobile
- Đảm bảo app đã được cài đặt như PWA
- Kiểm tra quyền thông báo trong cài đặt điện thoại
- Trên iOS, chỉ hoạt động với Safari 16.4+

### Push không hoạt động trên desktop
- Kiểm tra quyền thông báo trong browser settings
- Thử refresh trang và đăng ký lại

### Lỗi "VAPID not configured"
- Đảm bảo đã set VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY trong .env
- Restart backend sau khi thêm biến môi trường

## API Endpoints

- `GET /api/notifications/vapid-public-key` - Lấy VAPID public key
- `POST /api/notifications/subscribe` - Đăng ký push subscription
- `POST /api/notifications/unsubscribe` - Hủy đăng ký
- `GET /api/notifications/settings` - Lấy cài đặt thông báo
- `PUT /api/notifications/settings` - Cập nhật cài đặt
- `POST /api/notifications/test` - Gửi thông báo test
