@echo off
setlocal
title NurZeka Launcher

echo ==========================================
echo Risale-i Nur AI Baslatiliyor... (NurZeka)
echo ==========================================
echo.

set "ROOT=%~dp0"
set "RAG_DIR=%ROOT%rag_service"
set "BACKEND_DIR=%ROOT%backend"

if not exist "%RAG_DIR%\app.py" (
	echo [HATA] rag_service\app.py bulunamadi.
	pause
	exit /b 1
)

if not exist "%ROOT%start_python_loop.bat" (
	echo [HATA] start_python_loop.bat bulunamadi.
	pause
	exit /b 1
)

echo [1/2] RAG servisi aciliyor (http://localhost:8000)...
start "NurZeka RAG" cmd /k "call \"%ROOT%start_python_loop.bat\""

echo RAG servisi icin 3 saniye bekleniyor...
timeout /t 3 /nobreak >nul

echo [2/2] Backend aciliyor...
cd /d "%BACKEND_DIR%"
npm start

pause
