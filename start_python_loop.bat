@echo off
:loop
echo Port temizleniyor...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do taskkill /PID %%a /F 2>nul
timeout /t 2 /nobreak >nul

echo Python servisi baslatiliyor...
cd /d "%~dp0rag_service"
python app.py

echo Servis kapandi, 3 saniye sonra yeniden baslatiliyor...
timeout /t 3 /nobreak >nul
goto loop
