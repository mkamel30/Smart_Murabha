# Install_Murabha_Smart.ps1
$repo = "mkamel30/Smart_Murabha"
$appName = "Smart Murabha"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "$appName.lnk"

Write-Host "--- Smart Murabha Installer v1.1.0 ---" -ForegroundColor Cyan

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Warning: Not running as Administrator." -ForegroundColor Yellow
}

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

if (-not $destFolder -or $destFolder.Length -le 3) {
    $targetDrive = (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Name -ne "C" -and $_.Free -gt 1GB } | Select-Object -First 1).Root
    if (-not $targetDrive) { $targetDrive = "C:\" }
    $destFolder = Join-Path $targetDrive "Smart_Murabha"
}
Write-Host "Target directory: $destFolder" -ForegroundColor Green

if (!(Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder -Force | Out-Null }

if ($isAdmin) {
    Write-Host "Adding Defender exclusion..." -ForegroundColor Cyan
    try { Add-MpPreference -ExclusionPath $destFolder -ErrorAction SilentlyContinue } catch { }
}

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
    $zipAsset = $release.assets | Where-Object { $_.name -like "*-win.zip" } | Select-Object -First 1
    $downloadUrl = $zipAsset.browser_download_url
} catch {
    Write-Host "Error: GitHub Connection failed." -ForegroundColor Red
    pause; exit
}

Write-Host "Closing application..." -ForegroundColor DarkYellow
Stop-Process -Name "Smart_Murabha" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$zipPath = Join-Path $env:TEMP "murabha_update.zip"
Write-Host "Downloading version $($release.tag_name)..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

Write-Host "Extracting files..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath $destFolder -Force

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

Write-Host "SUCCESS: Application updated!" -ForegroundColor Green
Remove-Item $zipPath -ErrorAction SilentlyContinue
Start-Process -FilePath $exePath -WorkingDirectory $workDir

pause
