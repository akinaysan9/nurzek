@echo off
echo ==========================================
echo Node.js Surecleri Temizleniyor...
echo ==========================================
taskkill /F /IM node.exe
timeout /t 2 >nul
echo.
echo Sunucu Yeniden Baslatiliyor...
echo.
cd backend
npm start
pause
