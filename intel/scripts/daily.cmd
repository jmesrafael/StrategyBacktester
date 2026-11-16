@echo off
rem Daily run of the intelligence system. Read-only: it refreshes public candles, rebuilds datasets and reports, and takes a small backup.
rem It does NOT pull git repos, touch bots, the VPS, or any database. Log: intel\logs\daily.log
cd /d "%~dp0.."
if not exist logs mkdir logs
echo ===== %date% %time% ===== >> logs\daily.log
pushd ..\candles
node update.js --no-1m >> ..\intel\logs\daily.log 2>&1
popd
node run.js all >> logs\daily.log 2>&1
node run.js snapshot >> logs\daily.log 2>&1
echo exit %errorlevel% >> logs\daily.log
