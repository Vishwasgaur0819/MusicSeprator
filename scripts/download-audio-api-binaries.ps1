# Download react-native-audio-api prebuilt binaries (Windows)
# Run once after npm install: powershell -ExecutionPolicy Bypass -File scripts/download-audio-api-binaries.ps1

$ErrorActionPreference = "Stop"
$Tag = "v3.1.0"
$BaseUrl = "https://github.com/software-mansion-labs/rn-audio-libs/releases/download/$Tag"
$Root = Split-Path -Parent $PSScriptRoot
$ModuleRoot = Join-Path $Root "node_modules\react-native-audio-api"
$Temp = Join-Path $Root "audioapi-binaries-temp"

New-Item -ItemType Directory -Force -Path $Temp | Out-Null

$downloads = @(
    @{
        Name = "android.zip"
        Dest = Join-Path $ModuleRoot "common\cpp\audioapi\external"
    },
    @{
        Name = "jniLibs.zip"
        Dest = Join-Path $ModuleRoot "android\src\main"
    }
)

foreach ($item in $downloads) {
    $zipPath = Join-Path $Temp $item.Name
    $url = "$BaseUrl/$($item.Name)"
    Write-Host "Downloading $url ..."
    Invoke-WebRequest -Uri $url -OutFile $zipPath
    Write-Host "Extracting to $($item.Dest) ..."
    New-Item -ItemType Directory -Force -Path $item.Dest | Out-Null
    Expand-Archive -Path $zipPath -DestinationPath $item.Dest -Force
}

Remove-Item -Recurse -Force $Temp
Write-Host "Audio API binaries installed."
