@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 goto failed
)
call npm.cmd run build
if errorlevel 1 goto failed
echo Keep this window open while using Govorilka.
call npm.cmd run preview -- --port 4173 --open
exit /b
:failed
echo Startup failed. See the error above.
pause
