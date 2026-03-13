@echo off
title NurZeka Ingest Repair
echo ===================================================
echo   NurZeka - Installing Ingestion Dependencies
echo ===================================================
echo.
echo [INFO] Installing langchain and dependencies...
python -m pip install langchain langchain-community langchain-text-splitters

echo.
echo [INFO] Verifying installation...
python -c "import langchain; print('SUCCESS: LangChain installed.')"

if %errorlevel% neq 0 (
    echo [ERROR] Installation failed.
    pause
) else (
    echo [SUCCESS] Dependencies ready.
    echo now running ingestion...
    timeout /t 2 >nul
    python rag_service/ingest.py
)
pause
