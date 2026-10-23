@echo off
cd /d "%~dp0"
title XPi Lock Staking - Portable
echo.
echo ========================================
echo    XPi Lock Staking (Portable)
echo    Min stake: 31.4 XLM
echo ========================================
echo.
node.exe stake-claim.js
echo.
pause