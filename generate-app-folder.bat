@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo   Smart Murabha - Zero-Install Folder Generator
echo ====================================================

:: 1. Cleanup
echo [1/6] Cleaning previous builds...
if exist "output" rd /s /q "output" 2>nul
if exist "electron\release" rd /s /q "electron\release" 2>nul
echo Cleaning finished (ignoring locks).

:: 2. Dependencies
echo [2/6] Verifying root dependencies...
call npm install --quiet

echo [2/6] Collecting production dependencies...
if exist "electron\temp_deps" rd /s /q "electron\temp_deps"
mkdir "electron\temp_deps"
copy "electron\package.json" "electron\temp_deps\package.json"
cd electron\temp_deps
call npm install --omit=dev --quiet
cd ..\..

echo [2/6] Including Prisma engine and client...
if not exist "electron\temp_deps\node_modules\@prisma" mkdir "electron\temp_deps\node_modules\@prisma"
if not exist "electron\temp_deps\node_modules\.prisma" mkdir "electron\temp_deps\node_modules\.prisma"
xcopy /s /e /y /q "node_modules\@prisma\*" "electron\temp_deps\node_modules\@prisma\"
xcopy /s /e /y /q "node_modules\.prisma\*" "electron\temp_deps\node_modules\.prisma\"

:: 3. Frontend Build
echo [3/6] Building Frontend (React)...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed.
    goto :error
)
cd ..

:: 4. Backend Build
echo [4/6] Building Backend (Node.js)...
cd backend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend build failed.
    goto :error
)
cd ..

:: 5. Electron Build (Folder)
echo [5/6] Packaging Electron App (Folder)...
cd electron
call npm run dist
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Electron packaging failed.
    goto :error
)
cd ..

:: 6. Finalizing & Zipping
echo [6/6] Finalizing artifacts...
if not exist "output" mkdir "output"

echo [6/6] Zipping the application folder...
powershell -Command "Compress-Archive -Path 'electron\release\win-unpacked\*' -DestinationPath 'output\Smart-Murabha-App.zip' -Force"

echo.
echo ====================================================
echo   SUCCESS! Your Zero-Install App is ready in:
echo   C:\Users\mkame\OneDrive\Documents\GitHub\V2_Murabha\output\Smart-Murabha-App.zip
echo.
echo   Instructions:
echo   1. Unzip the file to any permanent folder (e.g., C:\SmartMurabha)
echo   2. Run 'Payment & Sales Desktop App.exe' from that folder.
echo ====================================================
pause
exit /b 0

:error
echo.
echo [ERROR] BUILD FAILED! Please check the logs above.
pause
exit /b 1
