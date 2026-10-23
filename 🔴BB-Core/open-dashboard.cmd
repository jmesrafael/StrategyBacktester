@echo off
REM Opens the Lucid'io monitor (http://127.0.0.1:8787) in the browser. Safe to click any time: it only reads; the bot keeps running.
REM If the dashboard is already open somewhere, this just opens the page again. Close this window to stop the dashboard.
title Lucid'io dashboard
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed on this machine: https://nodejs.org & pause & exit /b 1)
node dashboard.js
if errorlevel 1 pause
