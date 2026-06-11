@echo off
chcp 65001 >nul
title PureDisk
echo ===================================================
echo Welcome to PureDisk Space Analyzer
echo ===================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js is NOT installed on this computer!
    echo [Error] Your computer does not have Node.js installed.
    echo ===================================================
    echo Please install Node.js from: https://nodejs.org/
    echo ===================================================
    pause
    exit /b
)

echo [Info] Starting backend native server...
echo [Info] Opening http://localhost:3000 in your browser...
echo ===================================================

start /b cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:3000"

node server.js
pause
