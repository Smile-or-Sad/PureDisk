@echo off
chcp 65001 >nul
title PureDisk
echo ===================================================
echo Welcome to PureDisk Space Analyzer
echo ===================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js is NOT installed on this computer!
    echo [Error] 您的电脑上未安装 Node.js！
    echo ===================================================
    echo To run this application, you must install Node.js first.
    echo Please follow these steps:
    echo 1. Visit the official website: https://nodejs.org/
    echo 2. Download the "LTS" ^(Long Term Support^) version.
    echo 3. Install it with default settings.
    echo 4. Restart your computer and double-click start.bat again.
    echo.
    echo 运行此程序需要依赖 Node.js 环境，请按以下步骤安装：
    echo 1. 访问官方网站：https://nodejs.org/
    echo 2. 下载带有 "LTS"^(长期支持版^) 字样的安装包。
    echo 3. 按照默认设置一直点击下一步完成安装。
    echo 4. 安装完成后，最好重启一下电脑，再次双击运行本 start.bat 即可。
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
