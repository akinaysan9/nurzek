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

:: 1. Start Python RAG Service
echo [1/2] Starting AI Brain (Python Service on port 8000)...
echo Logs will be visible in the new window.
:: Start Python from rag_service folder
start "NurZeka Python Brain" cmd /c "\"%ROOT%start_python_loop.bat\""

:: Wait a moment for Python to initialize
echo Waiting for AI Brain to warm up...
timeout /t 5 /nobreak >nul

:: 2. Start Node.js Backend
echo [2/2] Starting Website Backend (Node.js on port 3001)...
cd /d "%NODE_ROOT%"
if not exist node_modules (
    echo [INFO] Installing Node.js dependencies...
    call npm install
)

call npm start

pause
