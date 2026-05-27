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

### AI engine setup

The app now prepares the fp16 model automatically on first run:

- Downloads `htdemucs_ft_vocals_fp16weights.onnx` to app cache
- Shows progress in the Home/Processing UI
- Retries failed downloads automatically

Manual model install is kept only as an advanced fallback action.

## Run

```bash
# Start Metro
npm start

# Android (separate terminal)
npm run android

# iOS (macOS only)
npm run ios
```

## Release APK (Android)

1. **Release keystore** (one-time; keep backups of the keystore and passwords):

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/generate-release-keystore.ps1
   copy android\keystore.properties.example android\keystore.properties
   # Edit keystore.properties with your passwords
   ```

   `keystore.properties` is required for release builds.

2. **Build the APK**:

   ```bash
   npm run android:release
   ```

   Output: `android/app/build/outputs/apk/release/app-release.apk`

3. **Play Store (AAB)**:

   ```bash
   npm run android:bundle
   ```

   Output: `android/app/build/outputs/bundle/release/app-release.aab`

Release builds bundle only **arm** CPU architectures (`armeabi-v7a`, `arm64-v8a`) to keep the APK smaller. Models are downloaded on first run by default.

## Hybrid fallback configuration

Runtime switches live in `src/config/runtime.ts`:

- `separationMode`: `on-device` | `hybrid` | `cloud`
- `cloudApiBaseUrl`: set your backend base URL to enable cloud fallback
- `cloudApiToken`: optional bearer token
- `cloudTimeoutMs`, `cloudPollIntervalMs`: cloud retry behavior

Cloud API contract expected by the app:

- `POST /v1/separation/jobs` (multipart field: `file`) -> `{ "jobId": "..." }`
- `GET /v1/separation/jobs/:jobId` -> 
  - `{ "state": "queued" | "processing", "progress": 0..1 }`
  - `{ "state": "completed", "stems": { "vocalsUrl": "...", "instrumentalUrl": "..." } }`
  - `{ "state": "failed", "error": "..." }`

## Telemetry and rollout controls

- Separation telemetry is appended to `Caches/telemetry/separation-events.jsonl`
- Events include preflight, on-device, and cloud fallback outcomes
- Use `runtimeConfig.separationMode` as kill switch for staged rollout:
  - Start with `on-device`
  - Move to `hybrid` for partial rollout
  - Switch to `cloud` if on-device instability spikes

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

- On-device mode keeps audio local
- Hybrid/cloud mode uploads source audio only when fallback is used
- Session temp files live in app cache and are deleted when you start over or leave the mixer
- Exported files are saved via the OS share sheet to a location you choose
- Add your own retention policy on cloud backend before production rollout

## Tech Stack

- React Native CLI 0.85
- `onnxruntime-react-native` — stem separation
- `react-native-audio-api` — decode, synced playback, and export (WAV)
- `react-native-fs` — temp file storage
- `@react-native-documents/picker` — file picker
- `react-native-share` — export share sheet
