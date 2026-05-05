# Install_Murabha_Smart.ps1
$repo = "mkamel30/Smart_Murabha"
$appName = "Smart Murabha"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "$appName.lnk"

Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "   Smart Murabha - Intelligent Installer v1.1.0   " -ForegroundColor Cyan
Write-Host "--------------------------------------------------" -ForegroundColor Cyan

# 0. Check for Administrator Privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Warning: Not running as Administrator." -ForegroundColor Yellow
    Write-Host "Windows Defender exclusion might not be added automatically." -ForegroundColor Gray
    Write-Host "Please run PowerShell as Administrator for the best experience." -ForegroundColor Gray
    Write-Host "--------------------------------------------------" -ForegroundColor Cyan
}

# 1. Detect current location
$destFolder = ""
if (Test-Path $shortcutPath) {
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $existingShortcut = $WshShell.CreateShortcut($shortcutPath)
        $exePath = $existingShortcut.TargetPath
        if ($exePath) {
            $destFolder = Split-Path $exePath -Parent
            if ($destFolder.EndsWith("\") -and $destFolder.Length -gt 3) { $destFolder = $destFolder.Substring(0, $destFolder.Length - 1) }
        }
    } catch { }
}

# 2. Choose drive
if (-not $destFolder -or $destFolder.Length -le 3) {
    $targetDrive = (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Name -ne "C" -and $_.Free -gt 1GB } | Select-Object -First 1).Root
    if (-not $targetDrive) { $targetDrive = "C:\" }
    $destFolder = Join-Path $targetDrive "Smart_Murabha"
}
Write-Host "Target directory: $destFolder" -ForegroundColor Green

# Ensure folder exists
if (!(Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder -Force | Out-Null }

# 3. Add Windows Defender Exclusion
if ($isAdmin) {
    Write-Host "Adding Windows Defender exclusion for $destFolder..." -ForegroundColor Cyan
    try {
        Add-MpPreference -ExclusionPath $destFolder -ErrorAction Stop
        Write-Host "Exclusion added successfully!" -ForegroundColor Green
    } catch {
        Write-Host "Failed to add exclusion. You might need to add it manually." -ForegroundColor Red
    }
}

# 4. Fetch from GitHub
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
    $zipAsset = $release.assets | Where-Object { $_.name -like "*-win.zip" } | Select-Object -First 1
    $downloadUrl = $zipAsset.browser_download_url
} catch {
    Write-Host "Error: Could not connect to GitHub." -ForegroundColor Red
    pause; exit
}

# 5. Close app
Write-Host "Closing application if running..." -ForegroundColor DarkYellow
Stop-Process -Name "Smart_Murabha" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 6. Download and Extract
$zipPath = Join-Path $env:TEMP "murabha_update.zip"
Write-Host "Downloading version $($release.tag_name)..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

Write-Host "Extracting files..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath $destFolder -Force

# 7. Shortcuts
$exePath = Join-Path $destFolder "Smart_Murabha.exe"
$workDir = $destFolder
$startupPath = [Environment]::GetFolderPath("Startup")
$shortcuts = @($shortcutPath, (Join-Path $startupPath "$appName.lnk"))

foreach ($path in $shortcuts) {
    Write-Host "Updating shortcut: $path" -ForegroundColor Green
    $Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($path)
    $Shortcut.TargetPath = $exePath
    $Shortcut.WorkingDirectory = $workDir
    $Shortcut.IconLocation = "$exePath,0"
    $Shortcut.Save()
}

Write-Host "SUCCESS: Smart Murabha is ready!" -ForegroundColor Green
Remove-Item $zipPath -ErrorAction SilentlyContinue
Start-Process -FilePath $exePath -WorkingDirectory $workDir

Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "Press any key to exit."
pause
