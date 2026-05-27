# Build a signed release APK (requires npm install + audio-api binaries).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Android = Join-Path $Root "android"

Push-Location $Android
try {
    & .\gradlew.bat assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
    $Apk = Join-Path $Android "app\build\outputs\apk\release\app-release.apk"
    if (Test-Path $Apk) {
        Write-Host "`nRelease APK:`n  $Apk"
    }
} finally {
    Pop-Location
}
