@echo off
REM Starts the BBOT (BB Breakout) PAPER bot and keeps it running (wakes 30s after every 4h candle close).
cd /d "%~dp0"
node bbot.js loop
