@echo off
title NurZeka Port Tester
echo ===================================================
echo   NurZeka - Deep Port Diagnostics
echo ===================================================
echo.
echo [INFO] Testing connectivity to localhost:3001...
powershell -Command "Test-NetConnection -ComputerName localhost -Port 3001"
echo.
echo [INFO] Testing connectivity to 127.0.0.1:3001...
powershell -Command "Test-NetConnection -ComputerName 127.0.0.1 -Port 3001"
echo.
echo [INFO] Dumping all listening ports...
netstat -ano | findstr "LISTENING" | findstr ":3001"
echo.
pause
