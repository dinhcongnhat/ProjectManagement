@echo off
chcp 65001 >nul
title JTSC - Build Production

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              BUILD PRODUCTION VERSION                        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Build Frontend
echo [1/2] Building Frontend...
echo ──────────────────────────────────────────────────────────────
cd frontend

:: Kiểm tra và cài đặt dependencies
if not exist "node_modules" (
    echo [INFO] Cài đặt dependencies...
    call npm install
)

:: Tạo PWA icons
if not exist "public\icons\icon-192x192.png" (
    echo [INFO] Tạo PWA icons...
    call npm run generate-icons
)

:: Build
echo [INFO] Đang build...
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo [OK] Build Frontend thành công!
    echo [INFO] Output: frontend/dist
) else (
    echo [ERROR] Build Frontend thất bại!
    pause
    exit /b 1
)

cd ..

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    BUILD HOÀN TẤT!                           ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║  Frontend build: frontend/dist                               ║
echo ║                                                              ║
echo ║  Để deploy:                                                  ║
echo ║  1. Copy thư mục dist lên hosting                            ║
echo ║  2. Hoặc sử dụng: npm run preview                            ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
