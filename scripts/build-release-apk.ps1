# Build a signed release APK (requires npm install + audio-api binaries).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Android = Join-Path $Root "android"

Push-Location $Android
try {
    $Apk = Join-Path $Android "app\build\outputs\apk\release\app-release.apk"
    if (Test-Path $Apk) {
        Remove-Item $Apk -Force
    }

    & .\gradlew.bat "assembleRelease" "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a"
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle assembleRelease failed with exit code $LASTEXITCODE"
    }

    if (Test-Path $Apk) {
        Write-Host "`nRelease APK:`n  $Apk"
    } else {
        throw "Release APK was not produced at expected path: $Apk"
    }
} finally {
    Pop-Location
}
