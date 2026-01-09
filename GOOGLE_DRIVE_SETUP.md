# Hướng dẫn Cấu hình Google Drive

Để tính năng Google Drive hoạt động, bạn cần tạo project trên Google Cloud Console và lấy Credentials.

## Bước 1: Tạo Project trên Google Cloud
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2. Nhấn vào dropdown chọn project ở thanh trên cùng, chọn **New Project**.
3. Đặt tên (ví dụ: `Project Management Drive`) và nhấn **Create**.

## Bước 2: Kích hoạt Google Drive API
1. Sau khi chọn project vừa tạo, mở menu bên trái (3 gạch ngang) -> **APIs & Services** -> **Enabled APIs & services**.
2. Nhấn **+ ENABLE APIS AND SERVICES**.
3. Tìm kiếm **"Google Drive API"**.
4. Chọn kết quả và nhấn **Enable**.

## Bước 3: Cấu hình OAuth Consent Screen
1. Vào mục **OAuth consent screen** bên menu trái.
2. Chọn **External** (nếu bạn không dùng Google Workspace tổ chức) và nhấn **Create**.
3. Điền thông tin bắt buộc:
    - **App name**: Tên ứng dụng (ví dụ: Project Manager).
    - **User support email**: Email của bạn.
    - **Developer contact information**: Email của bạn.
4. Nhấn **Save and Continue** qua các bước Scopes (không cần thêm scope đặc biệt ở đây, code sẽ tự yêu cầu).
5. Ở bước **Test users**, nhấn **+ ADD USERS** và thêm email Google của chính bạn (quan trọng để test).

## Bước 4: Tạo Credentials (Client ID & Secret)
1. Vào mục **Credentials** bên menu trái.
2. Nhấn **+ CREATE CREDENTIALS** -> **OAuth client ID**.
3. **Application type**: Chọn **Web application**.
4. **Name**: Web client 1 (hoặc tùy ý).
5. **Authorized JavaScript origins**:
    - Thêm: `http://localhost:3000` (hoặc domain frontend của bạn).
6. **Authorized redirect URIs**:
    - Thêm: `http://localhost:3000/google-callback`
    *(Lưu ý: URL này phải khớp CHÍNH XÁC với biến môi trường `GOOGLE_REDIRECT_URI`)*.
7. Nhấn **Create**.
8. Một bảng hiện ra chứa **Client ID** và **Client Secret**.

## Bước 5: Cấu hình biến môi trường (Backend)
Mở file `c:\ProjectManagement\backend\.env` và thêm/cập nhật 3 dòng sau với thông tin bạn vừa lấy:

```ini
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/google-callback
```

*Lưu ý: Sau khi lưu file .env, bạn cần khởi động lại backend service để thay đổi có hiệu lực.*

---

## Các API cần thiết
Hệ thống sử dụng các API/Scope sau (đã được cấu hình trong code):
- `https://www.googleapis.com/auth/drive.readonly`: Để xem và tải file.
- `https://www.googleapis.com/auth/userinfo.email`: Lấy email người dùng.
- `https://www.googleapis.com/auth/userinfo.profile`: Lấy thông tin cơ bản.
