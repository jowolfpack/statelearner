@echo off
setlocal
cd /d "%~dp0"
set "URL=http://localhost:5173/"

rem Already running? Just open it. Clicking twice must not start a second
rem server on another port.
netstat -ano | findstr /r /c:":5173 " | findstr /i "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo StateLearner is already running - opening it.
  start "" "%URL%"
  exit /b 0
)

if not exist "node_modules" (
  echo First run - installing dependencies, this takes a minute...
  call npm install || goto :error
)

echo Starting StateLearner. Close this window to stop it.
call npm run dev
goto :eof

:error
echo.
echo Something went wrong. Press any key to close.
pause >nul
