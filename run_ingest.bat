@echo off
title NurZeka Data Ingestion
echo ===================================================
echo   NurZeka - Data Ingestion (Indexing)
echo ===================================================
echo.
echo [INFO] Reading markdown files from rag_service/data/ ...
echo [INFO] Creating Vectors and FAISS Index...
echo.

python rag_service/ingest.py

echo.
if %errorlevel% neq 0 (
    echo [ERROR] Ingestion failed. Please check the error message.
) else (
    echo [SUCCESS] Index created successfully!
    echo You can now ask questions.
)
pause
