@echo off
chcp 65001 > nul
:: BatchGotAdmin
::-------------------------------------
REM  --> Check for permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

REM --> If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    set params = %*
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"

    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    pushd "%CD%"
    CD /D "%~dp0"
::--------------------------------------

echo ===================================================
echo     Smart Murabha - System Setup ^& Firewall
echo ===================================================
echo.

echo [1/3] Downloading Visual C++ Redistributable...
curl -L -o vc_redist.x64.exe https://aka.ms/vs/17/release/vc_redist.x64.exe
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to download VC++ Redistributable. Please check your internet.
    pause
    exit /B
)

echo.
echo [2/3] Installing Visual C++ Redistributable...
vc_redist.x64.exe /install /quiet /norestart
if %ERRORLEVEL% EQU 0 (
    echo [OK] Installed successfully.
) else if %ERRORLEVEL% EQU 1638 (
    echo [OK] Already installed (newer or same version).
) else if %ERRORLEVEL% EQU 3010 (
    echo [OK] Installed successfully. A system restart might be needed later.
) else (
    echo [INFO] Installation returned code %ERRORLEVEL%. It might already be installed.
)

echo.
echo [3/3] Configuring Windows Firewall for Port 3005...
netsh advfirewall firewall add rule name="Smart Murabha Port 3005 (In)" dir=in action=allow protocol=TCP localport=3005 profile=any
netsh advfirewall firewall add rule name="Smart Murabha Port 3005 (Out)" dir=out action=allow protocol=TCP localport=3005 profile=any
echo [OK] Firewall configured.

echo.
echo Cleaning up...
del vc_redist.x64.exe

echo.
echo ===================================================
echo Setup complete! You can now run Smart Murabha.exe
echo ===================================================
pause
