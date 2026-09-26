$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$rootDir = (Resolve-Path "$PSScriptRoot\..").Path
$desktopDir = [Environment]::GetFolderPath("Desktop")

Write-Host "1. Compiling EndcordInstaller.exe..."
& $csc `
    /resource:"$rootDir\dist\patcher.js" `
    /resource:"$rootDir\dist\preload.js" `
    /resource:"$rootDir\dist\renderer.js" `
    /resource:"$rootDir\dist\renderer.css" `
    /resource:"$rootDir\app_logo.png" `
    /out:"$rootDir\EndcordInstaller.exe" `
    /target:winexe `
    /win32icon:"$rootDir\app_icon.ico" `
    /win32manifest:"$rootDir\app.manifest" `
    /optimize+ `
    /platform:anycpu `
    /langversion:5 `
    /debug- `
    "$rootDir\InstallerGUI.cs"

if ($LASTEXITCODE -ne 0) { throw "csc failed" }

Write-Host "2. Waiting 3 seconds to release file handle..."
Start-Sleep -Seconds 3

Write-Host "3. Signing EndcordInstaller.exe with local Developer Certificate..."
$cert = Get-ChildItem Cert:\CurrentUser\My\A17A3B4BC43BBD13EB1CE9CFFEBB8A37567EC319 -ErrorAction SilentlyContinue
if ($cert) {
    $sig = Set-AuthenticodeSignature -FilePath "$rootDir\EndcordInstaller.exe" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
    Write-Host "Signature Status: $($sig.Status)"
} else {
    Write-Host "Notice: Certificate A17A3B4BC43BBD13EB1CE9CFFEBB8A37567EC319 not found."
}

Start-Sleep -Seconds 2

Write-Host "4. Copying EndcordInstaller.exe to Desktop & Endcord-site..."
if (Test-Path $desktopDir) {
    Copy-Item "$rootDir\EndcordInstaller.exe" "$desktopDir\EndcordInstaller.exe" -Force
}
if (Test-Path "$desktopDir\Endcord-site") {
    Copy-Item "$rootDir\EndcordInstaller.exe" "$desktopDir\Endcord-site\EndcordInstaller.exe" -Force
}

Write-Host "5. Creating EndcordInstaller.zip..."
if (Test-Path $desktopDir) {
    Compress-Archive -Path "$rootDir\EndcordInstaller.exe" -DestinationPath "$desktopDir\EndcordInstaller.zip" -Force
}
if (Test-Path "$desktopDir\Endcord-site") {
    Copy-Item "$desktopDir\EndcordInstaller.zip" "$desktopDir\Endcord-site\EndcordInstaller.zip" -Force
}

if (Test-Path "$rootDir\install.sh") {
    if (Test-Path $desktopDir) {
        Copy-Item "$rootDir\install.sh" "$desktopDir\install.sh" -Force
    }
    if (Test-Path "$desktopDir\Endcord-site") {
        Copy-Item "$rootDir\install.sh" "$desktopDir\Endcord-site\install.sh" -Force
        Copy-Item "$rootDir\install.sh" "$desktopDir\Endcord-site\EndcordInstallerCli-linux" -Force
    }
}
if (Test-Path "$rootDir\linux\gui.py") {
    if (Test-Path "$desktopDir\Endcord-site") {
        New-Item -ItemType Directory -Force -Path "$desktopDir\Endcord-site\linux" | Out-Null
        Copy-Item "$rootDir\linux\gui.py" "$desktopDir\Endcord-site\linux\gui.py" -Force
    }
}

Write-Host "EXE BUILT SUCCESSFULLY."
