@echo off
REM Starts the 1h PAPER bot in the background (no window). Safe to run twice: it refuses if one is already running.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Location).Path; $f=Join-Path $d 'state\bot.pid'; if(Test-Path $f){$p=(Get-Content $f -Raw|ConvertFrom-Json).pid; if(Get-Process -Id $p -ErrorAction SilentlyContinue){Write-Output ('Already running, pid '+$p); exit 0}}; $si=New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0}; $r=Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine='node lucidio.js loop'; CurrentDirectory=$d; ProcessStartupInformation=$si}; Write-Output ('Started, pid '+$r.ProcessId)"
