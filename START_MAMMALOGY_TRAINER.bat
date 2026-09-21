@echo off
setlocal
cd /d "%~dp0"
echo Starting Mammalogy Practical Trainer...
start "Mammalogy Trainer Server" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" 8765
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8765/index.html"
echo.
echo The trainer is now open in your browser.
echo You can close this window after the browser opens.
endlocal
