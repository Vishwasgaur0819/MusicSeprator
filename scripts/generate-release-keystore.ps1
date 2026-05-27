# Create android/app/musicapp-release.keystore for release APK signing.
# You will be prompted for passwords; remember them for android/keystore.properties.

$ErrorActionPreference = "Stop"
$AppDir = Join-Path (Split-Path -Parent $PSScriptRoot) "android\app"
$Keystore = Join-Path $AppDir "musicapp-release.keystore"

if (Test-Path $Keystore) {
    Write-Error "Keystore already exists: $Keystore"
}

$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
    Write-Error "keytool not found. Install JDK 17+ and ensure keytool is on PATH."
}

Write-Host "Creating release keystore at:`n  $Keystore`n"
& keytool -genkeypair -v `
    -storetype PKCS12 `
    -keystore $Keystore `
    -alias musicapp `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname "CN=MusicApp, OU=Mobile, O=MusicApp, L=Unknown, ST=Unknown, C=US"

Write-Host "`nDone. Copy android/keystore.properties.example to android/keystore.properties and set your passwords."
