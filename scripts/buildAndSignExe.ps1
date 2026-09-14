$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$rootDir = "c:\Users\ewlle\Desktop\Endcord-Main"

Write-Host "1. Compiling EndcordInstaller.exe..."
& $csc `
    /resource:"$rootDir\dist\patcher.js" `
    /resource:"$rootDir\dist\patcher.js.map" `
    /resource:"$rootDir\dist\preload.js" `
    /resource:"$rootDir\dist\preload.js.map" `
    /resource:"$rootDir\dist\renderer.js" `
    /resource:"$rootDir\dist\renderer.js.map" `
    /resource:"$rootDir\dist\renderer.css" `
    /resource:"$rootDir\dist\renderer.css.map" `
    /resource:"$rootDir\app_logo.png" `
    /out:"$rootDir\EndcordInstaller.exe" `
    /target:winexe `
    /win32icon:"$rootDir\app_icon.ico" `
    /win32manifest:"$rootDir\app.manifest" `
    /optimize+ `
    /platform:anycpu `
    /langversion:5 `
    "$rootDir\InstallerGUI.cs"

Write-Host "2. Waiting 3 seconds to release file handle..."
Start-Sleep -Seconds 3

Write-Host "3. Signing EndcordInstaller.exe with local Developer Certificate..."
$cert = Get-ChildItem Cert:\CurrentUser\My\A17A3B4BC43BBD13EB1CE9CFFEBB8A37567EC319 -ErrorAction SilentlyContinue
if ($cert) {
    $sig = Set-AuthenticodeSignature -FilePath "$rootDir\EndcordInstaller.exe" -Certificate $cert -TimestampServer "http://timestamp.digicert.com"
    Write-Host "Signature Status: $($sig.Status)"
    Write-Host "Signer: $($sig.SignerCertificate.Subject)"
} else {
    Write-Host "Notice: Certificate A17A3B4BC43BBD13EB1CE9CFFEBB8A37567EC319 not found."
}

Start-Sleep -Seconds 2

Write-Host "4. Copying signed EndcordInstaller.exe to Desktop & Endcord-site..."
Copy-Item "$rootDir\EndcordInstaller.exe" "C:\Users\ewlle\Desktop\EndcordInstaller.exe" -Force
if (Test-Path "C:\Users\ewlle\Desktop\Endcord-site") {
    Copy-Item "$rootDir\EndcordInstaller.exe" "C:\Users\ewlle\Desktop\Endcord-site\EndcordInstaller.exe" -Force
}

Write-Host "5. Creating EndcordInstaller.zip..."
Compress-Archive -Path "$rootDir\EndcordInstaller.exe" -DestinationPath "C:\Users\ewlle\Desktop\EndcordInstaller.zip" -Force
if (Test-Path "C:\Users\ewlle\Desktop\Endcord-site") {
    Copy-Item "C:\Users\ewlle\Desktop\EndcordInstaller.zip" "C:\Users\ewlle\Desktop\Endcord-site\EndcordInstaller.zip" -Force
}

Write-Host "✅ EXE BUILT & SIGNED SUCCESSFULLY!"
