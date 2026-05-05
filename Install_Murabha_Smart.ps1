# Install_Murabha_Smart.ps1
$repo = "mkamel30/Smart_Murabha"
$appName = "Smart Murabha"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "$appName.lnk"

Write-Host "Searching for previous installation..." -ForegroundColor Cyan

# 1. Detect current location
$destFolder = ""
if (Test-Path $shortcutPath) {
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $existingShortcut = $WshShell.CreateShortcut($shortcutPath)
        $exePath = $existingShortcut.TargetPath
        if ($exePath) {
            $destFolder = Split-Path (Split-Path $exePath -Parent) -Parent
            Write-Host "Found existing installation at: $destFolder" -ForegroundColor Green
        }
    } catch {
        Write-Host "Warning: Could not read shortcut. Will perform fresh install." -ForegroundColor Gray
    }
}

# 2. Choose drive
if (-not $destFolder) {
    $targetDrive = (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Name -ne "C" -and $_.Free -gt 1GB } | Select-Object -First 1).Root
    if (-not $targetDrive) { $targetDrive = "C:\" }
    $destFolder = Join-Path $targetDrive "Smart_Murabha"
    Write-Host "Target directory: $destFolder" -ForegroundColor Yellow
}

# 3. Fetch from GitHub
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
    $zipAsset = $release.assets | Where-Object { $_.name -like "*-win.zip" } | Select-Object -First 1
    $downloadUrl = $zipAsset.browser_download_url
} catch {
    Write-Host "Error: Could not connect to GitHub." -ForegroundColor Red
    pause
    exit
}

if (!(Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder | Out-Null }

# 4. Close app
Write-Host "Closing application if running..." -ForegroundColor Orange
Stop-Process -Name "Smart_Murabha" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 5. Download and Extract
$zipPath = Join-Path $env:TEMP "murabha_update.zip"
Write-Host "Downloading version $($release.tag_name)..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
} catch {
    Write-Host "Error: Download failed." -ForegroundColor Red
    pause
    exit
}

Write-Host "Extracting files..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipPath -DestinationPath $destFolder -Force
} catch {
    Write-Host "Error: Extraction failed. Please ensure the app is closed." -ForegroundColor Red
    pause
    exit
}

# 6. Shortcuts
$exePath = Join-Path $destFolder "win-unpacked\Smart_Murabha.exe"
$workDir = Join-Path $destFolder "win-unpacked"
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

Write-Host "SUCCESS: Update completed! Starting application..." -ForegroundColor Green
Remove-Item $zipPath -ErrorAction SilentlyContinue
Start-Process -FilePath $exePath -WorkingDirectory $workDir

Write-Host "Press any key to close this window."
pause
