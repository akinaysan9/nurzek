@echo off
setlocal
title NurZeka Environment Repair

echo ===================================================
echo   NurZeka - Environment Repair & Launch
echo ===================================================
echo.

echo [1/3] Verifying Python Environment...
python --version
echo.

echo [2/3] Force Re-installing Critical Libraries...
:: Ensure all dependencies, including python-multipart which is required by FastAPI
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn openai sentence-transformers faiss-cpu python-dotenv requests typing-extensions pydantic python-multipart

echo.
echo [3/3] Verifying Imports...
python -c "import fastapi; import uvicorn; import openai; import multipart; print('SUCCESS: All modules found.')"
if %errorlevel% neq 0 (
    echo [CRITICAL ERROR] Modules are still missing.
    echo Please check your Python installation.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   Repair Complete. Starting System...
echo ===================================================
echo.

:: Start Python Service using uvicorn module directly (most robust method)
start "NurZeka Python Brain" cmd /k "python -m uvicorn rag_service.app:app --host 0.0.0.0 --port 8000 --reload || echo [ERROR] Python Service Failed & pause"

:: Wait for Python to start listening
timeout /t 8 /nobreak >nul

:: Start Node.js
cd backend
if not exist node_modules (
    call npm install
)

:: Check if port 3001 is already in use, just in case
netstat -ano | findstr :3001 >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 3001 seems busy. Node might fail to start if another instance is running.
)

npm start

pause
