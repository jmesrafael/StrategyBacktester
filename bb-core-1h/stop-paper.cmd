@echo off
REM Stops the 1h PAPER bot. Its state stays in state\ and it carries on from there when started again.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f='state\bot.pid'; if(Test-Path $f){$p=(Get-Content $f -Raw|ConvertFrom-Json).pid; Stop-Process -Id $p -ErrorAction SilentlyContinue; Remove-Item $f -ErrorAction SilentlyContinue; Write-Output ('Stopped pid '+$p)} else {Write-Output 'Not running'}"
