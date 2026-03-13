@echo off
title NurZeka Status Check
echo ===================================================
echo   NurZeka - System Status Check
echo ===================================================
echo.

echo [1/3] Checking Port 3001 (Node.js)...
netstat -ano | findstr ":3001"
if %errorlevel% neq 0 (
    echo [ERROR] Nothing is listening on Port 3001. Node.js is NOT running.
) else (
    echo [OK] Port 3001 is active.
)
echo.

echo [2/3] Checking Port 8000 (Python Brain)...
netstat -ano | findstr ":8000"
if %errorlevel% neq 0 (
    echo [ERROR] Nothing is listening on Port 8000. Python Service is NOT running.
) else (
    echo [OK] Port 8000 is active.
)
echo.

echo [3/3] Testing HTTP Response from Localhost...
curl -v http://localhost:3001/api/health
echo.
echo.

pause
