# 🚀 Hướng Dẫn Deploy JTSC Project Management Lên Server Linux

## Mục Lục

1. [Yêu Cầu Hệ Thống](#1-yêu-cầu-hệ-thống)
2. [Cài Đặt Môi Trường](#2-cài-đặt-môi-trường)
3. [Cài Đặt PostgreSQL](#3-cài-đặt-postgresql)
4. [Cài Đặt MinIO (Object Storage)](#4-cài-đặt-minio-object-storage)
5. [Clone và Cấu Hình Dự Án](#5-clone-và-cấu-hình-dự-án)
6. [Build Frontend](#6-build-frontend)
7. [Cấu Hình Nginx (Reverse Proxy + SSL)](#7-cấu-hình-nginx-reverse-proxy--ssl)
8. [Chạy Ứng Dụng Với PM2](#8-chạy-ứng-dụng-với-pm2)
9. [Cấu Hình Tường Lửa (Firewall)](#9-cấu-hình-tường-lửa-firewall)
10. [Cấu Hình SSL Với Let's Encrypt](#10-cấu-hình-ssl-với-lets-encrypt)
11. [OnlyOffice Document Server (Tùy Chọn)](#11-onlyoffice-document-server-tùy-chọn)
12. [Cập Nhật Ứng Dụng](#12-cập-nhật-ứng-dụng)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Yêu Cầu Hệ Thống

| Thành phần | Yêu cầu tối thiểu |
|---|---|
| **OS** | Ubuntu 22.04 LTS / Debian 12 / CentOS 9 |
| **CPU** | 2 cores |
| **RAM** | 4 GB (khuyến nghị 8 GB) |
| **Ổ đĩa** | 40 GB SSD |
| **Node.js** | v20.x trở lên |
| **PostgreSQL** | v15 trở lên |
| **Nginx** | latest |

### Cấu trúc dự án

```
ProjectManagement/
├── backend/          # Express.js API (Port 3001)
│   ├── prisma/       # Prisma ORM schema & migrations
│   ├── src/          # Source code
│   └── .env          # Backend environment variables
├── frontend/         # Vite + React (Build → dist/)
│   ├── src/          # Source code
│   ├── public/       # Static assets + manifest.json (PWA)
│   └── .env          # Frontend environment variables
└── package.json      # Root scripts
```

### Kiến trúc triển khai

```
                     ┌─────────────────────────────────┐
                     │         Nginx (Port 80/443)       │
                     │   Reverse Proxy + SSL + Static    │
                     └─────────┬───────────┬────────────┘
                               │           │
                    ┌──────────▼──┐  ┌─────▼──────────┐
                    │  Frontend   │  │    Backend      │
                    │ (dist/)     │  │  (Port 3001)    │
                    │ Static HTML │  │  Express + WS   │
                    └─────────────┘  └──────┬──────────┘
                                            │
                              ┌─────────────┼──────────────┐
                              │             │              │
                        ┌─────▼────┐  ┌─────▼────┐  ┌─────▼──────┐
                        │PostgreSQL│  │  MinIO   │  │OnlyOffice  │
                        │  (5432)  │  │  (9000)  │  │  (Tùy chọn)│
                        └──────────┘  └──────────┘  └────────────┘
```

---

## 2. Cài Đặt Môi Trường

### 2.1 Cập nhật hệ thống

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Cài đặt các công cụ cần thiết

```bash
sudo apt install -y curl wget git build-essential unzip
```

### 2.3 Cài đặt Node.js v20

```bash
# Cài đặt Node.js v20 qua NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Kiểm tra phiên bản
node --version   # v20.x.x
npm --version    # 10.x.x
```

### 2.4 Cài đặt PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 2.5 Cài đặt Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 3. Cài Đặt PostgreSQL

### 3.1 Cài đặt PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3.2 Tạo database và user

```bash
# Đăng nhập vào PostgreSQL
sudo -u postgres psql

# Trong PostgreSQL shell:
CREATE USER jtsc_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE jtsc_db OWNER jtsc_user;
GRANT ALL PRIVILEGES ON DATABASE jtsc_db TO jtsc_user;
\q
```

### 3.3 Cấu hình cho phép kết nối từ xa (nếu cần)

```bash
# Chỉnh sửa postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf
# Tìm và sửa: listen_addresses = '*'

# Chỉnh sửa pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf
# Thêm dòng (thay CIDR phù hợp):
# host    jtsc_db    jtsc_user    0.0.0.0/0    md5

sudo systemctl restart postgresql
```

---

## 4. Cài Đặt MinIO (Object Storage)

### 4.1 Tải và cài đặt MinIO

```bash
# Tải MinIO server
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# Tạo user và thư mục lưu trữ
sudo useradd -r -s /sbin/nologin minio-user
sudo mkdir -p /data/minio
sudo chown minio-user:minio-user /data/minio
```

### 4.2 Tạo file cấu hình MinIO

```bash
sudo nano /etc/default/minio
```

Nội dung file:

```env
# MinIO Configuration
MINIO_ROOT_USER=jtsc
MINIO_ROOT_PASSWORD=jtsc12345
MINIO_VOLUMES="/data/minio"
MINIO_OPTS="--console-address :9001"
```

### 4.3 Tạo systemd service cho MinIO

```bash
sudo nano /etc/systemd/system/minio.service
```

Nội dung file:

```ini
[Unit]
Description=MinIO Object Storage
Documentation=https://docs.min.io
After=network-online.target
Wants=network-online.target

[Service]
User=minio-user
Group=minio-user
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_VOLUMES $MINIO_OPTS
Restart=always
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### 4.4 Khởi động MinIO

```bash
sudo systemctl daemon-reload
sudo systemctl enable minio
sudo systemctl start minio

# Kiểm tra trạng thái
sudo systemctl status minio
```

### 4.5 Tạo bucket

```bash
# Cài đặt MinIO Client (mc)
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Cấu hình mc
mc alias set local http://localhost:9000 jtsc jtsc12345

# Tạo bucket
mc mb local/projectmanagement
```

---

## 5. Clone và Cấu Hình Dự Án

### 5.1 Clone dự án

```bash
# Tạo thư mục ứng dụng
sudo mkdir -p /var/www/jtsc
sudo chown $USER:$USER /var/www/jtsc

# Clone dự án
cd /var/www/jtsc
git clone <YOUR_GIT_REPO_URL> .
```

### 5.2 Cài đặt dependencies

```bash
# Cài đặt tất cả dependencies
npm run install:all
```

### 5.3 Cấu hình Backend (.env)

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Nội dung file `backend/.env`:

```env
PORT=3001
DATABASE_URL="postgresql://jtsc_user:your_secure_password@localhost:5432/jtsc_db?schema=public"
JWT_SECRET=your_jwt_secret_key_here

# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=jtsc
MINIO_SECRET_KEY=jtsc12345
MINIO_BUCKET_NAME=projectmanagement

# OnlyOffice Configuration (nếu sử dụng)
ONLYOFFICE_URL=https://your-onlyoffice-domain.com
BACKEND_URL=https://your-domain.com/api
ONLYOFFICE_JWT_SECRET=your_onlyoffice_jwt_secret

# Push Notifications - VAPID Configuration
# Tạo VAPID keys: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=mailto:admin@your-domain.com

# Google Drive Configuration (nếu sử dụng)
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_REDIRECT_URI="https://your-domain.com/google-callback"
```

> **💡 Tạo VAPID Keys mới:** Chạy lệnh `npx web-push generate-vapid-keys` để tạo cặp VAPID keys.

### 5.4 Cấu hình Frontend (.env)

```bash
nano frontend/.env
```

Nội dung file `frontend/.env`:

```env
VITE_API_URL=https://your-domain.com/api
VITE_WS_URL=wss://your-domain.com
VITE_ONLYOFFICE_URL=https://your-onlyoffice-domain.com
```

> **⚠️ Lưu ý:** Thay `your-domain.com` bằng domain thực tế của bạn.

### 5.5 Khởi tạo Database

```bash
cd /var/www/jtsc

# Generate Prisma Client
npm run db:generate

# Đẩy schema lên database (tạo tables)
npm run db:push

# Chạy seed data (tạo tài khoản admin mặc định)
npm run db:seed
```

> **📋 Tài khoản admin mặc định:** `admin` / `admin123`

---

## 6. Build Frontend

```bash
cd /var/www/jtsc/frontend

# Build production
npm run build

# Kiểm tra thư mục dist đã được tạo
ls -la dist/
```

Thư mục `dist/` sẽ chứa các file static (HTML, CSS, JS) để Nginx serve.

---

## 7. Cấu Hình Nginx (Reverse Proxy + SSL)

### 7.1 Tạo file cấu hình Nginx

```bash
sudo nano /etc/nginx/sites-available/jtsc
```

Nội dung file (chưa có SSL - sẽ thêm sau):

```nginx
# Upstream cho WebSocket
upstream backend_ws {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name your-domain.com;

    # Giới hạn upload file
    client_max_body_size 1G;

    # Frontend - Static files
    root /var/www/jtsc/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/x-javascript
        application/xml
        application/xml+rss
        image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API Backend - Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 60s;

        # Tăng buffer cho file upload lớn
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # WebSocket - Socket.IO
    location /socket.io/ {
        proxy_pass http://backend_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # PWA Service Worker - Không cache
    location /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files $uri =404;
    }

    # PWA Manifest - Không cache
    location /manifest.json {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Content-Type "application/manifest+json";
        try_files $uri =404;
    }

    # Static assets - Cache dài hạn
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Icons và images
    location /icons/ {
        expires 30d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }

    # SPA Routing - Tất cả các route chuyển về index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 7.2 Kích hoạt cấu hình

```bash
# Tạo symlink
sudo ln -s /etc/nginx/sites-available/jtsc /etc/nginx/sites-enabled/

# Xóa cấu hình default (tùy chọn)
sudo rm -f /etc/nginx/sites-enabled/default

# Kiểm tra cấu hình
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 8. Chạy Ứng Dụng Với PM2

### 8.1 Tạo file cấu hình PM2

```bash
nano /var/www/jtsc/ecosystem.config.cjs
```

Nội dung file:

```javascript
module.exports = {
  apps: [
    {
      name: 'jtsc-backend',
      cwd: '/var/www/jtsc/backend',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Restart settings
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '1G',
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/jtsc/backend-error.log',
      out_file: '/var/log/jtsc/backend-out.log',
      merge_logs: true,
      // Watch (tắt trong production)
      watch: false,
    },
  ],
};
```

### 8.2 Tạo thư mục log

```bash
sudo mkdir -p /var/log/jtsc
sudo chown $USER:$USER /var/log/jtsc
```

### 8.3 Khởi chạy ứng dụng

```bash
cd /var/www/jtsc

# Khởi chạy
pm2 start ecosystem.config.cjs

# Kiểm tra trạng thái
pm2 status

# Xem logs
pm2 logs jtsc-backend

# Lưu danh sách process để auto-start khi reboot
pm2 save

# Cấu hình PM2 khởi động cùng hệ thống
pm2 startup
# Chạy lệnh mà PM2 xuất ra (ví dụ):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
```

### 8.4 Các lệnh PM2 hữu ích

```bash
# Restart ứng dụng
pm2 restart jtsc-backend

# Stop ứng dụng
pm2 stop jtsc-backend

# Reload (zero-downtime)
pm2 reload jtsc-backend

# Xem logs realtime
pm2 logs jtsc-backend --lines 100

# Monitor resources
pm2 monit
```

---

## 9. Cấu Hình Tường Lửa (Firewall)

```bash
# Cho phép SSH
sudo ufw allow 22/tcp

# Cho phép HTTP và HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Cho phép PostgreSQL (chỉ nếu cần truy cập từ xa)
# sudo ufw allow 5432/tcp

# Cho phép MinIO Console (chỉ nếu cần truy cập từ xa)
# sudo ufw allow 9001/tcp

# Bật tường lửa
sudo ufw enable

# Kiểm tra trạng thái
sudo ufw status
```

---

## 10. Cấu Hình SSL Với Let's Encrypt

### 10.1 Cài đặt Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 10.2 Lấy chứng chỉ SSL

```bash
# Tự động cấu hình SSL cho Nginx
sudo certbot --nginx -d your-domain.com

# Hoặc nếu có www subdomain:
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 10.3 Tự động gia hạn

```bash
# Kiểm tra auto-renewal
sudo certbot renew --dry-run

# Certbot tự động thêm cronjob/systemd timer để gia hạn
```

### 10.4 Cấu hình Nginx sau khi có SSL

Certbot sẽ tự động cập nhật file Nginx. Kiểm tra lại:

```bash
sudo nano /etc/nginx/sites-available/jtsc
```

File sẽ được Certbot thêm đoạn SSL tự động. Đảm bảo có redirect HTTP → HTTPS:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ... (giữ nguyên toàn bộ cấu hình location ở bước 7)
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 11. OnlyOffice Document Server (Tùy Chọn)

Nếu bạn cần tính năng chỉnh sửa tài liệu online (Word, Excel, PowerPoint), hãy cài đặt OnlyOffice Document Server.

### 11.1 Cài đặt bằng Docker

```bash
# Cài đặt Docker (nếu chưa có)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Chạy OnlyOffice Document Server
docker run -d \
  --name onlyoffice \
  --restart=always \
  -p 9980:80 \
  -e JWT_ENABLED=true \
  -e JWT_SECRET=your_onlyoffice_jwt_secret \
  onlyoffice/documentserver
```

### 11.2 Cấu hình Nginx cho OnlyOffice

Thêm server block mới hoặc sử dụng subdomain:

```nginx
server {
    listen 443 ssl http2;
    server_name onlyoffice.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/onlyoffice.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/onlyoffice.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:9980;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 12. Cập Nhật Ứng Dụng

### Script cập nhật tự động

Tạo file `/var/www/jtsc/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "=============================="
echo "  JTSC Project - Deploy Script"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================="

APP_DIR="/var/www/jtsc"
cd $APP_DIR

echo ""
echo "📥 1. Pulling latest code..."
git pull origin main

echo ""
echo "📦 2. Installing dependencies..."
npm run install:all

echo ""
echo "🗄️  3. Updating database schema..."
cd backend
npx prisma generate
npx prisma db push --accept-data-loss
cd ..

echo ""
echo "🔨 4. Building frontend..."
cd frontend
npm run build
cd ..

echo ""
echo "🔄 5. Restarting backend..."
pm2 restart jtsc-backend

echo ""
echo "✅ Deploy completed successfully!"
echo "=============================="
pm2 status
```

Cấp quyền thực thi:

```bash
chmod +x /var/www/jtsc/deploy.sh
```

Sử dụng:

```bash
cd /var/www/jtsc
./deploy.sh
```

---

## 13. Troubleshooting

### 13.1 Kiểm tra trạng thái các dịch vụ

```bash
# Nginx
sudo systemctl status nginx
sudo nginx -t

# PostgreSQL
sudo systemctl status postgresql

# MinIO
sudo systemctl status minio

# PM2/Backend
pm2 status
pm2 logs jtsc-backend --lines 50
```

### 13.2 Lỗi thường gặp

#### ❌ **502 Bad Gateway**

Nguyên nhân: Backend chưa chạy hoặc port sai.

```bash
# Kiểm tra backend
pm2 status
pm2 logs jtsc-backend

# Kiểm tra port
ss -tlnp | grep 3001
```

#### ❌ **Database connection refused**

```bash
# Kiểm tra PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT 1"

# Kiểm tra kết nối
psql "postgresql://jtsc_user:password@localhost:5432/jtsc_db"
```

#### ❌ **MinIO connection failed**

```bash
# Kiểm tra MinIO
sudo systemctl status minio
curl http://localhost:9000/minio/health/live
```

#### ❌ **WebSocket không kết nối**

Kiểm tra cấu hình Nginx cho `/socket.io/`:

```bash
# Test WebSocket
curl -v -H "Upgrade: websocket" -H "Connection: upgrade" \
  https://your-domain.com/socket.io/?transport=websocket
```

#### ❌ **PWA không hoạt động (không hiện Install prompt)**

- Đảm bảo HTTPS đã được bật
- Kiểm tra `manifest.json` có thể truy cập: `https://your-domain.com/manifest.json`
- Kiểm tra Service Worker: `https://your-domain.com/sw.js`
- Trong Chrome DevTools → Application → Manifest, kiểm tra lỗi

#### ❌ **Upload file lớn bị timeout**

```bash
# Tăng giới hạn trong Nginx
sudo nano /etc/nginx/sites-available/jtsc
# Đổi: client_max_body_size 1G;
# Thêm: proxy_read_timeout 600s;

sudo nginx -t && sudo systemctl reload nginx
```

### 13.3 Logs hữu ích

```bash
# Backend logs
pm2 logs jtsc-backend

# Nginx access/error logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# MinIO logs
sudo journalctl -u minio -f

# System logs
sudo journalctl -f
```

### 13.4 Backup Database

```bash
# Backup
pg_dump -U jtsc_user -h localhost jtsc_db > backup_$(date +%Y%m%d).sql

# Restore
psql -U jtsc_user -h localhost jtsc_db < backup_20260210.sql
```

### 13.5 Cron Job tự động backup

```bash
crontab -e
```

Thêm dòng (backup hàng ngày lúc 2h sáng):

```cron
0 2 * * * pg_dump -U jtsc_user -h localhost jtsc_db > /var/backups/jtsc/backup_$(date +\%Y\%m\%d).sql 2>&1
```

Tạo thư mục backup:

```bash
sudo mkdir -p /var/backups/jtsc
sudo chown $USER:$USER /var/backups/jtsc
```

---

## ✅ Checklist Sau Khi Deploy

- [ ] Truy cập `https://your-domain.com` → Hiện trang login
- [ ] Đăng nhập admin: `admin` / `admin123`
- [ ] Upload file hoạt động bình thường
- [ ] Chat realtime (WebSocket) hoạt động
- [ ] Push Notifications hoạt động
- [ ] PWA có thể "Add to Home Screen" trên mobile
- [ ] SSL certificate hợp lệ (biểu tượng 🔒 trên trình duyệt)
- [ ] OnlyOffice chỉnh sửa tài liệu (nếu sử dụng)
- [ ] Google Drive tích hợp (nếu sử dụng)
- [ ] Backup database tự động hoạt động

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề, kiểm tra:
1. **Logs**: `pm2 logs jtsc-backend`
2. **Nginx**: `sudo nginx -t && sudo tail -f /var/log/nginx/error.log`
3. **Database**: `sudo systemctl status postgresql`
4. **Health check**: `curl https://your-domain.com/api/health`
