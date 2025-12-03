@echo off
chcp 65001 >nul
title JTSC Project Management - All in One

:MENU
cls
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         JTSC PROJECT MANAGEMENT - ALL IN ONE                 ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║  Frontend: http://localhost:3000  ^|  https://jtsc.io.vn     ║
echo ║  Backend:  http://localhost       ^|  https://ai.jtsc.io.vn  ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo   [1] Khoi dong ung dung PRODUCTION (Frontend + Backend)
echo   [2] Khoi dong ung dung DEV (Frontend + Backend)
echo   [3] Dung tat ca servers
echo   [4] Build Production (PWA)
echo   [5] Cai dat moi truong (npm install)
echo   [6] Chi chay Frontend (Dev)
echo   [7] Chi chay Frontend (Production)
echo   [8] Chi chay Backend
echo   [9] Xem IP de truy cap tu dien thoai
echo   [0] Thoat
echo.
echo --------------------------------------------------------------
set /p choice="Chon chuc nang (0-9): "

if "%choice%"=="1" goto START_ALL_PROD
if "%choice%"=="2" goto START_ALL_DEV
if "%choice%"=="3" goto STOP_ALL
if "%choice%"=="4" goto BUILD
if "%choice%"=="5" goto SETUP
if "%choice%"=="6" goto START_FRONTEND_DEV
if "%choice%"=="7" goto START_FRONTEND_PROD
if "%choice%"=="8" goto START_BACKEND
if "%choice%"=="9" goto SHOW_IP
if "%choice%"=="0" goto EXIT
goto MENU

:START_ALL_PROD
cls
echo.
echo === KHOI DONG UNG DUNG PRODUCTION ===
echo.

cd /d "%~dp0"
echo [INFO] Thu muc: %CD%
echo.

echo [1/4] Build Frontend Production...
cd frontend
if not exist "node_modules" (
    echo [WARN] Cai dat dependencies Frontend...
    call npm install
)
call npm run build
cd ..
echo.

echo [2/4] Khoi dong Backend Server (Port 80)...
cd backend
if not exist "node_modules" (
    echo [WARN] Cai dat dependencies Backend...
    call npm install
)
start "JTSC Backend - Port 80" cmd /k "npx tsx src/index.ts"
echo [OK] Backend: http://localhost
cd ..
echo.

echo [3/4] Khoi dong Frontend Production (Port 3000)...
cd frontend
start "JTSC Frontend - Port 3000" cmd /k "npm run preview"
echo [OK] Frontend: http://localhost:3000
cd ..
echo.

echo [4/4] Doi server khoi dong...
timeout /t 5 /nobreak >nul

start "" "http://localhost:3000"

echo.
echo === KHOI DONG PRODUCTION THANH CONG! ===
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost
echo   Domain Frontend: https://jtsc.io.vn
echo   Domain Backend:  https://ai.jtsc.io.vn
goto PAUSE_MENU

:START_ALL_DEV
cls
echo.
echo === KHOI DONG UNG DUNG DEV ===
echo.

cd /d "%~dp0"
echo [INFO] Thu muc: %CD%
echo.

echo [1/3] Khoi dong Backend Server (Port 80)...
cd backend
if not exist "node_modules" (
    echo [WARN] Cai dat dependencies Backend...
    call npm install
)
start "JTSC Backend - Port 80" cmd /k "npx tsx src/index.ts"
echo [OK] Backend: http://localhost
cd ..
echo.

echo [2/3] Khoi dong Frontend Server (Port 3000)...
cd frontend
if not exist "node_modules" (
    echo [WARN] Cai dat dependencies Frontend...
    call npm install
)
start "JTSC Frontend - Port 3000" cmd /k "npm run dev"
echo [OK] Frontend: http://localhost:3000
cd ..
echo.

echo [3/3] Doi server khoi dong...
timeout /t 5 /nobreak >nul

start "" "http://localhost:3000"

echo.
echo === KHOI DONG DEV THANH CONG! ===
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost
echo   Domain Frontend: https://jtsc.io.vn
echo   Domain Backend:  https://ai.jtsc.io.vn
goto PAUSE_MENU

:STOP_ALL
cls
echo.
echo === DUNG TAT CA SERVERS ===
echo.
echo [INFO] Dang dung tat ca tien trinh Node.js...
taskkill /F /IM node.exe >nul 2>&1
echo [OK] Da dung tat ca servers!
goto PAUSE_MENU

:BUILD
cls
echo.
echo === BUILD PRODUCTION (PWA) ===
echo.

cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo [INFO] Cai dat dependencies...
    call npm install
)

echo [INFO] Dang build Frontend...
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Build thanh cong!
    echo [INFO] Output: frontend/dist
    echo.
    echo Chay Production: npm run preview
) else (
    echo [ERROR] Build that bai!
)
goto PAUSE_MENU

:SETUP
cls
echo.
echo === CAI DAT MOI TRUONG ===
echo.

cd /d "%~dp0"

echo [1/2] Cai dat Backend dependencies...
cd backend
call npm install
cd ..
echo.

echo [2/2] Cai dat Frontend dependencies...
cd frontend
call npm install
echo.

echo [OK] Cai dat hoan tat!
goto PAUSE_MENU

:START_FRONTEND_DEV
cls
echo.
echo === FRONTEND DEV SERVER (Port 3000) ===
echo.
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo [INFO] Cai dat dependencies...
    call npm install
)
echo [INFO] Khoi dong Frontend Dev...
call npm run dev
goto PAUSE_MENU

:START_FRONTEND_PROD
cls
echo.
echo === FRONTEND PRODUCTION (Port 3000) ===
echo.
cd /d "%~dp0frontend"
if not exist "dist" (
    echo [INFO] Chua build, dang build...
    call npm run build
)
echo [INFO] Khoi dong Frontend Production...
call npm run preview
goto PAUSE_MENU

:START_BACKEND
cls
echo.
echo === BACKEND SERVER (Port 80) ===
echo.
cd /d "%~dp0backend"
if not exist "node_modules" (
    echo [INFO] Cai dat dependencies...
    call npm install
)
echo [INFO] Khoi dong Backend...
call npx tsx src/index.ts
goto PAUSE_MENU

:SHOW_IP
cls
echo.
echo === THONG TIN TRUY CAP TU MOBILE ===
echo.
echo [LOCAL]
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost
echo.
echo [DOMAIN]
echo   Frontend: https://jtsc.io.vn
echo   Backend:  https://ai.jtsc.io.vn
echo.
echo [LAN - Truy cap tu cung mang WiFi]
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    echo   Frontend: http://%%a:3000
    echo   Backend:  http://%%a
)
echo.
echo [PWA] Truy cap tu trinh duyet mobile - Menu - Add to Home Screen
goto PAUSE_MENU

:PAUSE_MENU
echo.
echo --------------------------------------------------------------
pause
goto MENU

:EXIT
echo.
echo Tam biet!
exit
