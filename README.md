# MusicApp — Vocal & Music Mixer

Cross-platform React Native CLI app that separates vocals from music on-device, lets you adjust each with sliders, and export the mixed result.

## Features

- Upload songs (MP3, M4A, WAV, FLAC, etc.)
- On-device AI vocal separation (ONNX)
- Independent **Vocals** and **Music** sliders
- Real-time synced playback
- Export mixed audio as **WAV** (share sheet)
- Session files auto-deleted from cache when you leave

## Requirements

- Node.js 20+ (project targets 22+)
- Android Studio + JDK 17 (for Android builds)
- Xcode + CocoaPods (for iOS builds, macOS only)

## Setup

```bash
npm install
```

`npm install` automatically:
- Applies native dependency patches (`patch-package`)
- Downloads `react-native-audio-api` Android binaries (Windows PowerShell script)

For iOS (macOS only):

```bash
cd ios && pod install && cd ..
```

### AI Model (required)

1. Download `htdemucs_ft_vocals.onnx` from [StemSplitio/htdemucs-ft-vocals-onnx](https://huggingface.co/StemSplitio/htdemucs-ft-vocals-onnx)
2. In the app, tap **Install Model File** on the home screen and select the `.onnx` file

Or copy manually to the device cache path shown in the app.

## Run

```bash
# Start Metro
npm start

# Android (separate terminal)
npm run android

# iOS (macOS only)
npm run ios
```

## Project Structure

```
src/
├── screens/       Home, Processing, Mixer
├── navigation/    React Navigation stack
├── audio/         Decode, chunk, playback, export
├── ml/            ONNX model loading & separation
├── storage/       Ephemeral session management
└── components/    Sliders, progress, export UI
```

## Privacy

- All audio processing runs on your device
- No uploads to any server
- Session temp files live in app cache and are deleted when you start over or leave the mixer
- Exported files are saved via the OS share sheet to a location you choose

## Tech Stack

- React Native CLI 0.85
- `onnxruntime-react-native` — stem separation
- `react-native-audio-api` — decode, synced playback, and export (WAV)
- `react-native-fs` — temp file storage
- `@react-native-documents/picker` — file picker
- `react-native-share` — export share sheet
