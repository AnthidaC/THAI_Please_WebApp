@echo off
chcp 65001 >nul
title THAI Please WebApp - Local Dev Launcher (One-Click)

echo ==============================================================================
echo    THAI Please WebApp - รันระบบแบบ Local Development (Node.js)
echo ==============================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] ไม่พบ Node.js ในเครื่องนี้! กรุณาติดตั้ง Node.js v20+
    pause
    exit /b 1
)

echo [1/3] ตรวจสอบ dependencies...
if not exist "server\node_modules\" (
    echo ติดตั้ง server dependencies...
    cd server && call npm install && cd ..
)
if not exist "client\node_modules\" (
    echo ติดตั้ง client dependencies...
    cd client && call npm install && cd ..
)

echo.
echo [2/3] กำลังเริ่ม Backend และ Frontend ในหน้าต่างแยก...
start "THAI Please - Backend API" cmd /k "cd server && npm run dev"
timeout /t 3 /nobreak >nul
start "THAI Please - Frontend UI" cmd /k "cd client && npm run dev"

echo.
echo [3/3] รอระบบพร้อมทำงาน และเปิดหน้าเว็บอัตโนมัติ...
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo ==============================================================================
echo    ระบบเริ่มทำงานเรียบร้อยแล้ว!
echo ==============================================================================
echo    - Frontend: http://localhost:5173
echo    - Backend:  http://localhost:5000
echo ==============================================================================
echo.
pause
