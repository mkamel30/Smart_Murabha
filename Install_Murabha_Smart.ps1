# Install_Murabha_Smart.ps1
$repo = "mkamel30/Smart_Murabha"
$appName = "Smart Murabha"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "$appName.lnk"

Write-Host "🔍 جاري البحث عن تثبيت سابق..." -ForegroundColor Cyan

# 1. محاولة معرفة المكان الحالي من الاختصار
$destFolder = ""
if (Test-Path $shortcutPath) {
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $existingShortcut = $WshShell.CreateShortcut($shortcutPath)
        $exePath = $existingShortcut.TargetPath
        if ($exePath) {
            # الحصول على المجلد الأب (الذي يحتوي على win-unpacked)
            $destFolder = Split-Path (Split-Path $exePath -Parent) -Parent
            Write-Host "✅ تم العثور على التثبيت الحالي في: $destFolder" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ فشل قراءة الاختصار الحالي، سيتم اختيار مكان جديد." -ForegroundColor Gray
    }
}

# 2. إذا لم يجد تثبيت سابق، يبحث عن أفضل درايف
if (-not $destFolder) {
    $targetDrive = (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Name -ne "C" -and $_.Free -gt 1GB } | Select-Object -First 1).Root
    if (-not $targetDrive) { $targetDrive = "C:\" }
    $destFolder = Join-Path $targetDrive "Smart_Murabha"
    Write-Host "📍 تثبيت جديد في: $destFolder" -ForegroundColor Yellow
}

# 3. جلب بيانات التحديث من GitHub
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
    $zipAsset = $release.assets | Where-Object { $_.name -like "*-win.zip" } | Select-Object -First 1
    $downloadUrl = $zipAsset.browser_download_url
} catch {
    Write-Host "❌ فشل الاتصال بـ GitHub. يرجى التأكد من الإنترنت." -ForegroundColor Red
    pause
    exit
}

if (!(Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder | Out-Null }

# 4. إغلاق البرنامج إذا كان مفتوحاً
Write-Host "🛑 جاري إغلاق أي نسخ مفتوحة من البرنامج..." -ForegroundColor Orange
Stop-Process -Name "Smart_Murabha" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 5. التحميل والفك
$zipPath = Join-Path $env:TEMP "murabha_update.zip"
Write-Host "⏳ جاري تحميل الإصدار ($($release.tag_name))..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
} catch {
    Write-Host "❌ فشل تحميل الملف." -ForegroundColor Red
    pause
    exit
}

Write-Host "📦 جاري تحديث الملفات..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipPath -DestinationPath $destFolder -Force
} catch {
    Write-Host "❌ فشل فك الضغط. قد يكون البرنامج لا يزال مفتوحاً أو الصلاحيات غير كافية." -ForegroundColor Red
    pause
    exit
}

# 6. تحديث الاختصارات
$exePath = Join-Path $destFolder "win-unpacked\Smart_Murabha.exe"
$workDir = Join-Path $destFolder "win-unpacked"
$startupPath = [Environment]::GetFolderPath("Startup")

$shortcuts = @($shortcutPath, (Join-Path $startupPath "$appName.lnk"))

foreach ($path in $shortcuts) {
    Write-Host "✨ تحديث اختصار: $path" -ForegroundColor Green
    $Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($path)
    $Shortcut.TargetPath = $exePath
    $Shortcut.WorkingDirectory = $workDir
    $Shortcut.IconLocation = "$exePath,0"
    $Shortcut.Save()
}

Write-Host "✅ تمت عملية التحديث بنجاح! جاري تشغيل البرنامج..." -ForegroundColor Green
Remove-Item $zipPath -ErrorAction SilentlyContinue

# تشغيل البرنامج فوراً
Start-Process -FilePath $exePath -WorkingDirectory $workDir

pause
