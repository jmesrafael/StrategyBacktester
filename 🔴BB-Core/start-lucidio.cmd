@echo off
REM Starts the Lucid'io bot and keeps it running (wakes 30s after every 4h candle close).
cd /d "%~dp0"
node lucidio.js loop
