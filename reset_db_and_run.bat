@echo off
title NurZeka Database Reset
echo ===================================================
echo   NurZeka - Database Reset Tool
echo ===================================================
echo.
echo [WARNING] This will delete the existing database file.
echo Your chat history and notes will be clearer, but bookmarks might be lost.
echo.
echo [1/2] Removing 'nurzeka.sqlite'...
cd backend
if exist nurzeka.sqlite (
    del nurzeka.sqlite
    echo [OK] Database deleted.
) else (
    echo [INFO] No database found to delete.
)
echo.
echo [2/2] Starting Node.js to Re-initialize DB...
node server.js
pause
