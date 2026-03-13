@echo off
title NurZeka Debug Launcher
echo ===================================================
echo   NurZeka - Debug Mode
echo ===================================================
echo.

echo [1/2] Checking if Python is running...
tasklist | findstr "python" >nul
if %errorlevel% neq 0 (
    echo [WARNING] Python Service (Brain) is NOT running in background.
    echo Please run 'start_rag_system_v2.bat' first or ignore for frontend debug.
) else (
    echo [OK] Python Service seems active.
)
echo.

echo [2/2] Starting Node.js Backend directly (No hidden mode)...
echo Watch for any error messages below!
cd backend

:: Run node directly to see crash output
node server.js

pause
