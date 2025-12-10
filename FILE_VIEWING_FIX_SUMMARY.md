# FIXING FILE VIEWING - Tổng hợp vấn đề và giải pháp

## VẤN ĐỀ CHÍNH
1. **Minio AccessDenied Error**: Upload thành công nhưng đọc file bị lỗi "Valid and authorized credentials required"
2. **Avatar không hiển thị**: `/api/users/:id/avatar` trả về 404
3. **File OnlyOffice không mở được**: 403 Forbidden
4. **Ảnh trong Chat/Discussion không xem được**: NS_BINDING_ABORTED

## NGUYÊN NHÂN

### 1. Minio Credentials Issue
- **Vấn đề**: Cùng một minioClient vừa upload thành công, nhưng ngay sau đó getFileStats() và getObject() thất bại
- **Test kết quả**: 
  * presignedGetObject() hoạt động ✅
  * statObject() thất bại với AccessDenied ❌
  * getObject() thất bại với AccessDenied ❌

### 2. Route Conflicts  
- File `index.ts` có route `/api/users/:id/avatar` trực tiếp (dòng 137)
- Route này được define TRƯỚC `app.use('/api/users', userRoutes)` 
- Dẫn đến route trong userRoutes không bao giờ được gọi

### 3. Filename Encoding
- Tên file tiếng Việt bị garbled: `QÄ pd` thay vì `Quyết định`
- Multer gửi filename dạng latin1, cần convert sang UTF-8

## GIẢI PHÁP ĐÃ ÁP DỤNG

### 1. ✅ Chuyển sang Presigned URLs
Thay vì stream file qua backend (gặp lỗi credentials), dùng presigned URLs:

```typescript
// CŨ - Lỗi AccessDenied
const stats = await getFileStats(filename);
const stream = await getFileStream(filename);
stream.pipe(res);

// MỚI - Hoạt động
const presignedUrl = await getPresignedUrl(filename, 3600);
res.redirect(presignedUrl);
```

**Áp dụng cho:**
- ✅ `userController.ts` - serveUserAvatar()
- ✅ `chatController.ts` - serveMessageAttachment()  
- ✅ `onlyofficeController.ts` - downloadFileForOnlyOffice()
- ✅ `messageController.ts` - serveAttachment()

### 2. ✅ Fix Route Conflicts
- Xóa route `/api/users/:id/avatar` trong `index.ts`
- Để userRoutes.ts xử lý

### 3. ✅ Fix Filename Encoding
```typescript
// Hàm normalizeVietnameseFilename đã sửa
export const normalizeVietnameseFilename = (filename: string): string => {
    if (/[\xC0-\xFF]/.test(filename)) {
        // UTF-8 bytes được gửi dạng latin1
        const utf8Filename = Buffer.from(filename, 'latin1').toString('utf8');
        return utf8Filename.normalize('NFC').trim();
    }
    return filename.normalize('NFC').trim();
};
```

### 4. ✅ Loại bỏ timestamp prefix
**Đã sửa:**
- `userController.ts`: `avatars/${filename}` (không còn userId-timestamp)
- `projectController.ts`: `${filename}` (không còn timestamp)
- `messageController.ts`: `${projectId}/${filename}` cho file, `audio/recording-${timestamp}.webm` cho voice
- `chatController.ts`: `chat/${id}/${filename}` cho file, `chat/${id}/audio/recording-${timestamp}.webm` cho voice

## STATUS HIỆN TẠI

### Đã hoàn thành:
✅ Fix normalizeVietnameseFilename() 
✅ Chuyển sang presigned URLs cho tất cả file endpoints
✅ Xóa route conflict trong index.ts
✅ Update uploadAvatar để giữ tên gốc
✅ Update uploadFile trong chat/discussion để giữ tên gốc
✅ OnlyOffice download endpoint dùng presigned URL

### Cần test:
⏳ Upload avatar mới và xem có hiển thị
⏳ Upload file tiếng Việt trong chat
⏳ Mở file Office qua OnlyOffice
⏳ Xem ảnh trong discussion

## CÁCH TEST

### 1. Test Avatar
```bash
# Login
curl -X POST http://10.10.1.254:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"nhatdc","password":"Congnhat2002"}'

# Upload avatar
curl -X POST http://10.10.1.254:3001/api/users/profile/avatar \
  -H "Authorization: Bearer TOKEN" \
  -F "avatar=@test.png"

# View avatar (should redirect to Minio)
curl -I http://10.10.1.254:3001/api/users/5/avatar
# Expected: HTTP/1.1 302 Found + Location: https://apiminiojtsc.duckdns.org/...
```

### 2. Test File trong Chat
- Upload file tiếng Việt (ví dụ: "Quyết định 123.docx")
- Click để xem → should redirect to Minio presigned URL
- Filename trong Minio phải đúng UTF-8

### 3. Test OnlyOffice
- Upload file .docx vào project
- Click "View in OnlyOffice"
- OnlyOffice sẽ gọi `/api/onlyoffice/download/:id` → redirect to Minio
- File phải load được

## LƯU Ý QUAN TRỌNG

### Tại sao presigned URL hoạt động mà getObject không?
- **Presigned URL**: Minio tạo URL có chữ ký, browser truy cập TRỰC TIẾP vào Minio
- **getObject**: Backend gọi Minio API với credentials, sau đó stream qua backend
- Vấn đề: Có thể là bug trong minio-js library hoặc SSL session không được reuse đúng

### Lợi ích của presigned URLs:
✅ Bypass backend streaming → giảm tải cho server
✅ Client download trực tiếp từ Minio → nhanh hơn
✅ Không gặp lỗi AccessDenied
✅ Cache được ở CDN level (nếu có)

### Nhược điểm:
❌ URL có thời hạn (default 1 giờ)
❌ Expose Minio endpoint (nhưng có authentication trong URL)

## NEXT STEPS

1. **Restart backend** để áp dụng tất cả changes
2. **Test từng endpoint** theo hướng dẫn trên
3. **Kiểm tra Minio bucket** xem file có đúng tên không:
   ```bash
   cd backend
   npx tsx list_minio_files.ts
   ```
4. **Nếu vẫn lỗi**, check log để xác định endpoint nào còn dùng getFileStats/getFileStream

## FILES ĐÃ SỬA

- ✅ `backend/src/services/minioService.ts` - normalizeVietnameseFilename()
- ✅ `backend/src/controllers/userController.ts` - serveUserAvatar()
- ✅ `backend/src/controllers/chatController.ts` - serveMessageAttachment(), uploadFile patterns
- ✅ `backend/src/controllers/onlyofficeController.ts` - downloadFileForOnlyOffice()
- ✅ `backend/src/controllers/messageController.ts` - uploadFile patterns
- ✅ `backend/src/controllers/projectController.ts` - uploadFile pattern
- ✅ `backend/src/index.ts` - Xóa duplicate route
- ✅ `backend/src/config/minio.ts` - Log credentials để debug
