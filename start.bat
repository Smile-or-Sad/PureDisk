@echo off
title PureDisk - C-Drive Space Analyzer
echo ===================================================
echo            Welcome to PureDisk Space Analyzer!
echo ===================================================
echo  [Info] Starting backend native server...
echo  [Info] Opening http://localhost:3000 in your browser...
echo ===================================================
start http://localhost:3000
node server.js
pause
