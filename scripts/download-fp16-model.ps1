# Downloads the smaller FP16 HT-Demucs vocal separation model (~166 MB).
# Usage: .\scripts\download-fp16-model.ps1 [-PushToDevice]

param(
    [switch]$PushToDevice
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$modelsDir = Join-Path $root 'models'
$filename = 'htdemucs_ft_vocals_fp16weights.onnx'
$url = "https://huggingface.co/StemSplitio/htdemucs-ft-vocals-onnx/resolve/main/$filename"
$out = Join-Path $modelsDir $filename

New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

if (Test-Path $out) {
    $existing = (Get-Item $out).Length
    if ($existing -ge 165000000) {
        Write-Host "Model already present: $out ($existing bytes)"
    } else {
        Write-Host "Incomplete file found, re-downloading..."
        Remove-Item $out -Force
    }
}

if (-not (Test-Path $out)) {
    Write-Host "Downloading $filename from Hugging Face..."
    curl.exe -L --progress-bar -o $out $url
    if ($LASTEXITCODE -ne 0) {
        throw "Download failed"
    }
    Write-Host "Saved to $out ($((Get-Item $out).Length) bytes)"
}

if ($PushToDevice) {
    $devices = adb devices | Select-String 'device$'
    if (-not $devices) {
        Write-Warning 'No Android device connected. Skipping device push.'
        exit 0
    }

    Write-Host 'Pushing model to device app cache...'
    adb push $out /data/local/tmp/$filename | Out-Null
    adb shell "run-as com.musicapp mkdir -p cache/models && run-as com.musicapp cp /data/local/tmp/$filename cache/models/$filename"
    Write-Host 'FP16 model installed at com.musicapp cache/models (used automatically).'
}
