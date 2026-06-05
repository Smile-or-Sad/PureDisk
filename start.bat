@echo off
title PureDisk - C-Drive Space Analyzer
echo ===================================================
echo            Welcome to PureDisk Space Analyzer!
echo ===================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [Error] Node.js is NOT installed on this computer!
    echo  [错误] 您的电脑上未安装 Node.js！
    echo ===================================================
    echo  Please install Node.js from: https://nodejs.org/
    echo  请先前往官网下载并安装 Node.js，然后重新运行。
    echo ===================================================
    pause
    exit /b
)

echo  [Info] Starting backend native server...
echo  [Info] Opening http://localhost:3000 in your browser...
echo ===================================================

:: Delay opening browser by ~2 seconds to ensure server is fully started
start /b cmd /c "ping -n 3 127.0.0.1 >nul && start http://localhost:3000"

node server.js
pause
