@echo off
setlocal
title NurZeka System Launcher

echo ===================================================
echo   NurZeka - Risale-i Nur AI System Startup
echo ===================================================
echo.

:: Add Local Python Scripts to PATH for this session
set "PATH=%PATH%;C:\Users\aysan\AppData\Roaming\Python\Python313\Scripts"

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ and add it to PATH.
    pause
    exit /b 1
)

:: Check Node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js 18+.
    pause
    exit /b 1
)

:: Define paths
set "ROOT=%~dp0"
set "PY_ROOT=%ROOT%rag_service"
set "NODE_ROOT=%ROOT%backend"
set "PYTHON_EXE=python"

if exist "C:\python313\python.exe" (
    set "PYTHON_EXE=C:\python313\python.exe"
)

echo [INFO] Python executable: %PYTHON_EXE%

echo [INFO] Cleaning ports 8000 and 3001 if needed...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do taskkill /PID %%a /F >nul 2>&1
timeout /t 2 /nobreak >nul

:: 1. Start Python RAG Service
echo [1/2] Starting AI Brain (Python Service on port 8000)...
echo Logs will be visible in the new window.
start "NurZeka Python Brain" /D "%PY_ROOT%" cmd /k ""%PYTHON_EXE%" -m uvicorn app:app --host 127.0.0.1 --port 8000 --log-level warning"

:: Wait a moment for Python to initialize
echo Waiting for AI Brain to warm up...
timeout /t 8 /nobreak >nul

powershell -NoProfile -Command "try { $status = (Invoke-WebRequest -Uri http://127.0.0.1:8000/docs -UseBasicParsing -TimeoutSec 5).StatusCode; if ($status -ne 200) { exit 1 } } catch { exit 1 }"
if %errorlevel% neq 0 (
    echo [ERROR] Python service did not start on port 8000.
    echo Check the 'NurZeka Python Brain' window for details.
    pause
    exit /b 1
)

:: 2. Start Node.js Backend
echo [2/2] Starting Website Backend (Node.js on port 3001)...
start "NurZeka Backend" /D "%NODE_ROOT%" cmd /k "if not exist node_modules (echo [INFO] Installing Node.js dependencies... && call npm install) && call npm start"

echo Waiting for backend to warm up...
timeout /t 5 /nobreak >nul

powershell -NoProfile -Command "try { $status = (Invoke-WebRequest -Uri http://127.0.0.1:3001/api/health -UseBasicParsing -TimeoutSec 5).StatusCode; if ($status -ne 200) { exit 1 } } catch { exit 1 }"
if %errorlevel% neq 0 (
    echo [ERROR] Node backend did not start on port 3001.
    echo Check the 'NurZeka Backend' window for details.
    pause
    exit /b 1
)

echo.
echo [OK] NurZeka services are running.
echo [OK] Frontend/Backend: http://localhost:3001
echo [OK] Python RAG: http://127.0.0.1:8000/docs

pause
