@echo off
setlocal EnableExtensions
title NurZeka System Launcher V3

echo ===================================================
echo   NurZeka - Risale-i Nur AI System Startup V3
echo ===================================================
echo.

set "ROOT=%~dp0"
set "PY_ROOT=%ROOT%rag_service"
set "NODE_ROOT=%ROOT%backend"
set "PYTHON_EXE="

if exist "C:\python313\python.exe" (
    set "PYTHON_EXE=C:\python313\python.exe"
) else (
    for /f "delims=" %%i in ('where python 2^>nul') do (
        if not defined PYTHON_EXE set "PYTHON_EXE=%%i"
    )
)

if not defined PYTHON_EXE (
    echo [ERROR] Python bulunamadi.
    echo [INFO] Python 3.10+ kurulu olmali ya da PATH icinde olmali.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js bulunamadi.
    echo [INFO] Node.js 18+ kurulu olmali ve PATH icinde olmali.
    pause
    exit /b 1
)

echo [INFO] Python executable: %PYTHON_EXE%
echo [INFO] Root: %ROOT%
echo.

call :kill_port 8000
call :kill_port 3001

if not exist "%PY_ROOT%\app.py" (
    echo [ERROR] Python servis dosyasi bulunamadi: %PY_ROOT%\app.py
    pause
    exit /b 1
)

if not exist "%NODE_ROOT%\server.js" (
    echo [ERROR] Node backend dosyasi bulunamadi: %NODE_ROOT%\server.js
    pause
    exit /b 1
)

echo [1/2] Starting Python RAG service on port 8000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%PYTHON_EXE%' -WorkingDirectory '%PY_ROOT%' -ArgumentList '-m','uvicorn','app:app','--host','127.0.0.1','--port','8000','--log-level','warning'"

call :wait_http "Python RAG" "http://127.0.0.1:8000/docs" 120
if errorlevel 1 (
    echo [ERROR] Python service hazir olmadi.
    echo [INFO] Acilan 'NurZeka Python Brain' penceresini kontrol et.
    pause
    exit /b 1
)

echo [2/2] Starting Node backend on port 3001...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -WorkingDirectory '%NODE_ROOT%' -ArgumentList 'server.js'"

call :wait_http "Node Backend" "http://127.0.0.1:3001/api/health" 180
if errorlevel 1 (
    echo [ERROR] Node backend hazir olmadi.
    echo [INFO] Acilan backend penceresini kontrol et.
    pause
    exit /b 1
)

echo.
echo [OK] Tum servisler calisiyor.
echo [OK] Backend: http://127.0.0.1:3001
echo [OK] Python:  http://127.0.0.1:8000/docs
echo.
pause
exit /b 0

:kill_port
set "TARGET_PORT=%~1"
echo [INFO] Cleaning port %TARGET_PORT% if needed...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%TARGET_PORT% .*LISTENING" 2^>nul') do (
    taskkill /PID %%p /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
exit /b 0

:wait_http
set "SERVICE_NAME=%~1"
set "SERVICE_URL=%~2"
set "MAX_SECONDS=%~3"
set /a ELAPSED=0

:wait_http_loop
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri '%SERVICE_URL%' -UseBasicParsing -TimeoutSec 5; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not errorlevel 1 (
    echo [OK] %SERVICE_NAME% hazir.
    exit /b 0
)

if %ELAPSED% geq %MAX_SECONDS% (
    exit /b 1
)

set /a ELAPSED+=3
echo [INFO] Waiting for %SERVICE_NAME%... %ELAPSED%s/%MAX_SECONDS%s
timeout /t 3 /nobreak >nul
goto wait_http_loop