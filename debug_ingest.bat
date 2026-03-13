@echo off
title NurZeka Ingest Debug
echo ===================================================
echo   NurZeka - Ingest Debug
echo ===================================================
echo.
echo [INFO] Running ingestion with debug prints...
python rag_service/ingest.py
echo.
echo [INFO] Listing directory structure to verify paths...
dir "knowledge-base\kulliyat"
echo.
pause
