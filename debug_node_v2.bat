@echo off
title NurZeka Deep Debug
echo ===================================================
echo   NurZeka - Deep Debug Mode
echo ===================================================
echo.
cd backend

echo [INFO] Running 'node server.js' directly...
node server.js
if %errorlevel% neq 0 (
    echo.
    echo [CRITICAL ERROR] Node.js crashed with code %errorlevel%.
    echo Please read the error message above carefully.
)

echo.
echo ===================================================
echo   Process Finished.
echo ===================================================
pause
