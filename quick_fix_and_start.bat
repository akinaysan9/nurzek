@echo off
title NurZeka START
echo ===================================================
echo   NurZeka - SYSTEM STARTUP
echo ===================================================
echo.

echo [1/3] Moving Index Files to Correct Folder...
if exist "risale_index.faiss" (
    move /Y risale_index.faiss rag_service\
    echo [OK] Moved Index File.
)
if exist "risale_metadata.pkl" (
    move /Y risale_metadata.pkl rag_service\
    echo [OK] Moved Metadata File.
)

echo.
echo [2/3] Starting Python Brain...
start "NurZeka Python Brain" cmd /k "python -m uvicorn rag_service.app:app --host 0.0.0.0 --port 8000"

echo.
echo [3/3] Starting Website...
cd backend
start "NurZeka Website" cmd /k "node server.js"

echo.
echo ===================================================
echo   SYSTEM LAUNCHED! 🚀
echo   Go to: http://localhost:3001
echo ===================================================
pause
