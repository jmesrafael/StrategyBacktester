@echo off
rem Copies the recorded data from the VPS to this PC. Nothing is stored on the server for this and no secret is involved: it uses the same ssh login you already use.
rem   pull-recorder-data.cmd YOUR-VPS [target folder]       default target: D:\testing\Strat\recorder-data
rem Run it whenever you like. It replaces the local copy with the server's current one (the server never deletes anything, so nothing is lost).
if "%~1"=="" (echo usage: pull-recorder-data.cmd YOUR-VPS [target folder] & exit /b 2)
set "TARGET=%~2"
if "%TARGET%"=="" set "TARGET=D:\testing\Strat\recorder-data"
if not exist "%TARGET%" mkdir "%TARGET%"
echo Copying /var/lib/lucidio-recorder from %~1 to %TARGET% ...
ssh %~1 "tar -C /var/lib -czf - lucidio-recorder" | tar -xzf - -C "%TARGET%"
if errorlevel 1 (echo FAILED: check the ssh login and that the recorder is installed & exit /b 1)
echo Done: %TARGET%\lucidio-recorder
