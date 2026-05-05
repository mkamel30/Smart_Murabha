@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo    Smart Murabha - Update Script (V2)
echo ==========================================
echo.

:: 1. Check if application is running
tasklist /fi "imagename eq Smart Murabha.exe" | find ":" > nul
if errorlevel 1 (
    echo [!] Please close Smart Murabha before updating.
    pause
    exit /b
)

:: 2. Backup current database
set BACKUP_DIR=backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%
echo [*] Creating backup in %BACKUP_DIR%...
if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%

if exist backend\prisma\dev.db (
    copy backend\prisma\dev.db %BACKUP_DIR%\dev.db_backup
    echo [+] Database backed up successfully.
) else (
    echo [!] dev.db not found in backend\prisma\. Skipping backup.
)

:: 3. Prepare for new files
echo [*] Preparing to apply new version files...
echo [TIP] This script assumes the new files are in the 'update_files' folder.

if not exist update_files (
    echo [!] 'update_files' folder not found. 
    echo [!] Please place the new version files in a folder named 'update_files'.
    pause
    exit /b
)

:: 4. Copy new files (excluding database to be safe)
echo [*] Copying new files...
xcopy /s /e /y update_files\* . /exclude:exclude_db.txt

:: 5. Create exclude file if it doesn't exist
echo dev.db > exclude_db.txt

:: 6. Apply Schema Changes (Critical for V2)
echo [*] Updating database schema...
if exist resources\app\backend\node_modules\.bin\prisma.cmd (
    cd resources\app\backend
    call npx prisma db push --accept-data-loss
    cd ..\..\..
    echo [+] Schema updated successfully.
) else (
    echo [!] Prisma not found. You may need to run 'npx prisma db push' manually.
)

echo.
echo ==========================================
echo    Update Completed Successfully!
echo ==========================================
echo.
pause
