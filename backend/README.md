# MusicApp Backend (Hybrid Fallback)

Node.js backend that matches the mobile app contract in `src/network/separationApi.ts`.

## What it does

- Accepts audio uploads
- Creates async jobs
- Returns status (`queued`, `processing`, `completed`, `failed`)
- Serves `vocals.wav` and `instrumental.wav` download URLs

Current backend supports two separation engines:

- `ffmpeg` (default): center-channel karaoke-style approximation (fast, no Python deps)
- `demucs` (optional): better quality if you configure Demucs command

## Endpoints

- `POST /v1/separation/jobs` (multipart field: `file`) -> `{ jobId }`
- `GET /v1/separation/jobs/:jobId` -> job state and optional stems
- `GET /files/:jobId/vocals.wav`
- `GET /files/:jobId/instrumental.wav`
- `GET /health`

## Setup

```bash
cd backend
cp .env.example .env
npm install
```

If you want higher quality Demucs mode, install Python + Demucs and set:

```env
SEPARATION_ENGINE=demucs
DEMUCS_CMD=python -m demucs
```

### Demucs install (Windows)

```powershell
py -m pip install --upgrade pip
py -m pip install demucs
```

Then set in `.env`:

```env
SEPARATION_ENGINE=demucs
DEMUCS_CMD=py -m demucs
```

## Run

```bash
npm run dev
# or
npm start
```

Default server URL: `http://localhost:8787`

## Quick end-to-end test

With backend running in one terminal:

```bash
npm run e2e -- "..\\models\\sample.mp3"
```

Or with token/base URL:

```powershell
$env:BACKEND_URL="http://localhost:8787"
$env:API_TOKEN="your-token-if-enabled"
npm run e2e -- "..\\path\\to\\your-test.mp3"
```

Output stems are saved under `backend/e2e-output/<jobId>/`.

## Connect app to backend

Edit app runtime config:

- File: `src/config/runtime.ts`
- Set:
  - `separationMode: 'hybrid'` (or `'cloud'`)
  - `cloudApiBaseUrl: 'http://<your-server-ip>:8787'`
  - `cloudApiToken` if API token protection is enabled

For Android emulator use: `http://10.0.2.2:8787`.
For physical device, use your computer LAN IP and ensure phone + server are on same network.

## Production note

For production quality:

- Prefer `demucs` engine in dedicated worker instances.
- Keep `ffmpeg` as fallback for resilience.
- Move job state from in-memory `Map` to Redis/Postgres so jobs survive restarts.
- Store stems in object storage (S3/GCS) and return signed URLs.

