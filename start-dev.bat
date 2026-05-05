@echo off
TITLE Smart Murabha - Professional Dev Server
echo ====================================================
echo   Smart Murabha - Professional Dev System
echo ====================================================
echo.

:: 1. Cleanup old processes to free port 3005
echo [1/4] Clearing old processes on port 3005...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3005') do (
    if NOT "%%a"=="0" taskkill /f /pid %%a 2>nul
)

:: 2. Fast Build for Electron (To avoid ESM/TSX errors)
echo [2/4] Preparing Electron Desktop Environment...
cd electron
call npm run build
cd ..

:: 3. Launch everything concurrently
echo [3/4] Launching Stack (Backend + Frontend + Electron)...
echo.
call npx concurrently "npm run dev:backend" "npm run dev:frontend" "npm run dev:electron" --kill-others

pause
