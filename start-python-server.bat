@echo off
title Anime Card Battle - Python Server
cls

echo ========================================
echo   ANIME CARD BATTLE - DEV SERVER (Python)
echo ========================================
echo.
echo Starting on http://localhost:8080...
echo.
echo This bypasses ALL browser cache issues!
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found!
    echo Please install Python from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Found Python! Starting server...
echo.

REM Start Python HTTP server
cd /d "%~dp0"
python -m http.server 8080 --bind 127.0.0.1

pause
