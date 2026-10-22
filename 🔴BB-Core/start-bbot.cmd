@echo off
REM Starts the BBOT (BB Breakout) PAPER bot and keeps it running (wakes 30s after every 4h candle close).
REM Also opens the settings page (MEXC access/secret key, connection test, status) at http://127.0.0.1:8138
cd /d "%~dp0"
start "BBOT settings" /min node bbot-ui.js
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8138
node bbot.js loop
