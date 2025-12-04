# Chat Reactions & Mobile Optimizations

## Date: 2024-12-04

## Tính Năng Mới

### 1. **Thả Cảm Xúc Trên Tin Nhắn (Message Reactions)**

**Emojis hỗ trợ**: 👍 ❤️ 😂 😮 😢 😡

**Cách sử dụng**:
- **Desktop**: Di chuột qua tin nhắn → Click icon smile → Chọn emoji
- **Mobile**: Tap vào tin nhắn → Chọn emoji từ picker

**Tính năng**:
- ✅ Realtime reactions qua WebSocket
- ✅ Toggle reaction (click lần 2 để bỏ)
- ✅ Hiển thị số lượng reactions theo emoji
- ✅ Tooltip hiển thị tên người đã react
- ✅ Highlight reactions của bản thân

### 2. **Typing Indicator Được Cải Thiện**

**Hiển thị**: "Nguyễn Tuấn Anh đang soạn tin nhắn..."

**Cải tiến**:
- ✅ Hiển thị tên người đang gõ
- ✅ Animation dots đẹp hơn (màu xanh)
- ✅ Realtime qua WebSocket
- ✅ Auto-hide sau 3 giây không gõ

### 3. **Giao Diện Mobile Được Tối Ưu**

**Cải tiến UX**:
- ✅ Touch-friendly reactions (tap để mở picker)
- ✅ Larger touch targets cho buttons
- ✅ Better spacing và padding
- ✅ White background cho messages (dễ đọc hơn)
- ✅ Shadow và border nhẹ cho tin nhắn

### 4. **Avatar Trong Hồ Sơ Cá Nhân**

**Đã có sẵn**:
- ✅ Upload avatar trong trang Profile
- ✅ Lưu trực tiếp vào database (base64)
- ✅ Hiển thị trong chat và popup
- ✅ Validate file type và size (max 5MB)

## Database Changes

### New Table: ChatMessageReaction

```sql
CREATE TABLE "ChatMessageReaction" (
    "id" SERIAL PRIMARY KEY,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "messageId" INTEGER NOT NULL REFERENCES "ChatMessage"(id) ON DELETE CASCADE,
    "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    UNIQUE("messageId", "userId", "emoji")
);
```

## API Endpoints Mới

### Reactions

```
POST   /api/chat/messages/:messageId/reactions
Body: { emoji: "👍" }

DELETE /api/chat/messages/:messageId/reactions/:emoji
```

### Mark As Read

```
PUT    /api/chat/conversations/:id/read
```

## WebSocket Events

### Reactions

```typescript
// Server emit khi có reaction mới
socket.emit('chat:reaction_added', {
    conversationId: number,
    messageId: number,
    reactions: Reaction[]
});

// Server emit khi reaction bị xóa
socket.emit('chat:reaction_removed', {
    conversationId: number,
    messageId: number,
    reactions: Reaction[]
});
```

### Typing (Cải tiến)

```typescript
// Client emit khi đang gõ
socket.emit('chat:typing', {
    conversationId: number,
    userName: string,
    userId: number
});

// Client emit khi ngừng gõ
socket.emit('chat:stop_typing', {
    conversationId: number,
    userId: number
});
```

## Hướng Dẫn Deploy

### 1. Chạy Migration

```bash
cd backend
npx prisma migrate dev --name add_message_reactions
npx prisma generate
```

### 2. Rebuild Backend

```bash
npm run build
```

### 3. Rebuild Frontend

```bash
cd ../frontend
npm run build
```

### 4. Restart Services

```bash
# Restart backend
pm2 restart backend

# Or nếu dùng docker
docker-compose restart backend
```

## Files Đã Thay Đổi

### Backend

1. `prisma/schema.prisma`
   - Thêm model `ChatMessageReaction`
   - Thêm relation với User và ChatMessage

2. `src/controllers/chatController.ts`
   - Thêm `addReaction()` function
   - Thêm `removeReaction()` function
   - Thêm `markConversationAsRead()` function
   - Update `getMessages()` để include reactions

3. `src/routes/chatRoutes.ts`
   - Thêm routes cho reactions

4. `src/index.ts`
   - Cập nhật typing events

### Frontend

1. `src/components/ChatPopup.tsx`
   - Thêm `Reaction` interface
   - Thêm `REACTION_EMOJIS` constant
   - Thêm `showReactionPicker` state
   - Thêm WebSocket listeners cho reactions
   - Thêm `addReaction()`, `removeReaction()`, `toggleReaction()`
   - Cập nhật message render với reactions UI
   - Cải thiện typing indicator UI
   - Tối ưu mobile view

## Performance Optimizations

### WebSocket
- Sử dụng room-based messaging
- Optimistic updates cho reactions
- Debounced typing indicators

### Mobile
- Touch-optimized interactions
- Reduced layout shifts
- Better scroll behavior

## Testing Checklist

### Reactions
- [ ] Thêm reaction trên desktop
- [ ] Thêm reaction trên mobile
- [ ] Toggle reaction (thêm/xóa)
- [ ] Multiple users react cùng lúc
- [ ] Realtime sync giữa các devices
- [ ] Hiển thị tooltip với tên người react

### Typing Indicator
- [ ] Hiển thị khi người khác đang gõ
- [ ] Auto-hide sau 3 giây
- [ ] Hiển thị tên người đang gõ
- [ ] Multiple users typing

### Mobile UX
- [ ] Tap để mở reaction picker
- [ ] Scroll mượt
- [ ] Không bị overlap UI
- [ ] Touch targets đủ lớn

## Known Issues

1. Prisma type error cho `reactions` - Sẽ fix sau khi chạy migration
2. Animation có thể lag trên thiết bị yếu - Có thể disable nếu cần
