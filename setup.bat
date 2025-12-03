@echo off
chcp 65001 >nul
title JTSC - Development Setup

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║           CÀI ĐẶT MÔI TRƯỜNG PHÁT TRIỂN                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Kiểm tra Node.js
echo [1/5] Kiểm tra Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js chưa được cài đặt!
    echo [INFO] Vui lòng tải từ: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js đã cài đặt

:: Cài đặt Backend dependencies
echo.
echo [2/5] Cài đặt Backend dependencies...
echo ──────────────────────────────────────────────────────────────
cd backend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Lỗi cài đặt Backend!
    pause
    exit /b 1
)
echo [OK] Backend dependencies đã cài đặt
cd ..

:: Cài đặt Frontend dependencies
echo.
echo [3/5] Cài đặt Frontend dependencies...
echo ──────────────────────────────────────────────────────────────
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Lỗi cài đặt Frontend!
    pause
    exit /b 1
)
echo [OK] Frontend dependencies đã cài đặt

:: Tạo PWA icons
echo.
echo [4/5] Tạo PWA icons...
echo ──────────────────────────────────────────────────────────────
call npm run generate-icons
echo [OK] PWA icons đã tạo

cd ..

:: Hoàn tất
echo.
echo [5/5] Hoàn tất!
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                 CÀI ĐẶT THÀNH CÔNG!                          ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║  Các lệnh có sẵn:                                            ║
echo ║  • start-app.bat   - Khởi động ứng dụng                      ║
echo ║  • stop-app.bat    - Dừng ứng dụng                           ║
echo ║  • build-app.bat   - Build production                        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
