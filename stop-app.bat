@echo off
chcp 65001 >nul
title JTSC - Stop All Servers

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              DỪNG TẤT CẢ SERVERS                             ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo [INFO] Đang dừng tất cả tiến trình Node.js...

:: Dừng tất cả tiến trình node.js
taskkill /F /IM node.exe >nul 2>&1

echo [OK] Đã dừng tất cả servers!
echo.
echo Nhấn phím bất kỳ để đóng...
pause >nul
