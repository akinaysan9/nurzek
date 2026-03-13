@echo off
title NurZeka FINAL REPAIR
echo ===================================================
echo   NurZeka - COMPLETE SYSTEM REPAIR
echo ===================================================
echo.
echo [1/5] Installing ALL Prerequisites...
python -m pip install --upgrade pip
python -m pip install langchain langchain-community langchain-text-splitters sentence-transformers faiss-cpu fastapi uvicorn openai python-dotenv requests typing-extensions pydantic python-multipart colorama

echo.
echo [2/5] Creating Database Index (This takes time)...
python rag_service/ingest.py
if %errorlevel% neq 0 (
    echo [CRITICAL ERROR] Ingestion failed!
    pause
    exit /b 1
)

if not exist "rag_service/risale_index.faiss" (
    echo [CRITICAL ERROR] Index file was NOT created even though script finished.
    pause
    exit /b 1
)

echo.
echo [3/5] Stopping old processes...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM python.exe /T >nul 2>&1

echo.
echo [4/5] Starting Python Brain...
start "NurZeka Python Brain" cmd /k "python -m uvicorn rag_service.app:app --host 0.0.0.0 --port 8000"

echo.
echo [5/5] Starting Website...
cd backend
start "NurZeka Website" cmd /k "node server.js"

echo.
echo ===================================================
echo   SYSTEM REPAIRED AND STARTED.
echo   Please refresh http://localhost:3001
echo ===================================================
pause
