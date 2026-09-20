@echo off
cd /d "%~dp0"
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
