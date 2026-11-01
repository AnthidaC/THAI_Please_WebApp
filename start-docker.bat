@echo off
chcp 65001 >nul
title THAI Please WebApp - Docker One-Click Launcher

echo ==============================================================================
echo    THAI Please WebApp - ระบบจัดการโครงการ THAI Please (Docker Mode)
echo ==============================================================================
echo.

where docker >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] ไม่พบ Docker ในเครื่องนี้!
    echo กรุณาติดตั้ง Docker Desktop หรือดับเบิ้ลคลิก start-dev.bat เพื่อรันแบบ Local Node.js แทน
    echo.
    pause
    exit /b 1
)

docker info >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Docker Daemon ยังไม่ได้เริ่มทำงาน!
    echo กรุณาเปิดโปรแกรม Docker Desktop แล้วรอให้สถานะเป็น 'Engine running' จากนั้นรันไฟล์นี้ใหม่อีกครั้ง
    echo หรือดับเบิ้ลคลิก start-dev.bat เพื่อทดสอบทันทีโดยไม่ต้องเปิด Docker Desktop
    echo.
    pause
    exit /b 1
)

echo [1/3] กำลัง Build และ Start Containers ด้วย Docker Compose...
docker compose up -d --build

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] เกิดข้อผิดพลาดในการรัน Docker Compose
    pause
    exit /b 1
)

echo.
echo [2/3] รอระบบและ Nginx Proxy พร้อมทำงาน (ประมาณ 5 วินาที)...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] เปิดหน้าเว็บอัตโนมัติ...
start http://localhost:5173

echo ==============================================================================
echo    ระบบพร้อมใช้งานเรียบร้อยแล้ว!
echo ==============================================================================
echo    - Frontend App (Web):    http://localhost:5173
echo    - Backend API:          http://localhost:5000
echo    - Database Viewer (Adminer): http://localhost:8080
echo.
echo    * หากต้องการดู Logs:    docker compose logs -f
echo    * หากต้องการหยุดระบบ:    docker compose down
echo ==============================================================================
echo.
pause
