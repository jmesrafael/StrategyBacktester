@echo off
cd /d "%~dp0"
node lucidio.js status
echo.
powershell -NoProfile -Command "Get-Content state\bot.log -Tail 12"
pause
