require('dotenv').config();

const cors = require('cors');
const express = require('express');
const ffmpegPath = require('ffmpeg-static');
const morgan = require('morgan');
const multer = require('multer');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {randomUUID} = require('node:crypto');

const app = express();

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const API_TOKEN = process.env.API_TOKEN || '';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 30);
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const JOBS_DIR = path.join(DATA_DIR, 'jobs');
const SEPARATION_ENGINE = (process.env.SEPARATION_ENGINE || 'ffmpeg').toLowerCase();
const DEMUCS_CMD = process.env.DEMUCS_CMD || '';

const jobs = new Map();

function requireAuth(req, res, next) {
  if (!API_TOKEN) {
    next();
    return;
  }
  const auth = req.headers.authorization || '';
  const expected = `Bearer ${API_TOKEN}`;
  if (auth !== expected) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }
  next();
}

function safeBaseName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function ensureDirs() {
  await fsp.mkdir(UPLOAD_DIR, {recursive: true});
  await fsp.mkdir(JOBS_DIR, {recursive: true});
}

function setJobState(jobId, patch) {
  const current = jobs.get(jobId);
  if (!current) {
    return;
  }
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  jobs.set(jobId, next);
}

function getJobResponse(job) {
  const response = {
    state: job.state,
  };
  if (typeof job.progress === 'number') {
    response.progress = job.progress;
  }
  if (job.error) {
    response.error = job.error;
  }
  if (job.state === 'completed') {
    response.stems = job.stems;
  }
  return response;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: 'ignore'});
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${command}) with exit code ${code}`));
    });
  });
}

function runShellCommand(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {shell: true, stdio: 'ignore'});
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Shell command failed with exit code ${code}: ${command}`));
    });
  });
}

async function convertToWav(inputPath, outputPath) {
  if (!ffmpegPath) {
    throw new Error('FFmpeg binary is unavailable on server');
  }
  await runCommand(ffmpegPath, [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '2',
    '-ar',
    '44100',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ]);
}

async function findFirstFileRecursive(startDir, fileName) {
  const entries = await fsp.readdir(startDir, {withFileTypes: true});
  for (const entry of entries) {
    const fullPath = path.join(startDir, entry.name);
    if (entry.isFile() && entry.name === fileName) {
      return fullPath;
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const fullPath = path.join(startDir, entry.name);
    const nested = await findFirstFileRecursive(fullPath, fileName);
    if (nested) {
      return nested;
    }
  }
  return null;
}

async function processWithFfmpeg(sourceWavPath, vocalsPath, instrumentalPath) {
  if (!ffmpegPath) {
    throw new Error('FFmpeg binary is unavailable on server');
  }

  // Extract center-focused vocals (karaoke-style approximation).
  await runCommand(ffmpegPath, [
    '-y',
    '-i',
    sourceWavPath,
    '-af',
    'pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1,highpass=f=100,lowpass=f=8000,alimiter=limit=0.95',
    vocalsPath,
  ]);

  // Build instrumental by subtracting extracted vocals from the source.
  await runCommand(ffmpegPath, [
    '-y',
    '-i',
    sourceWavPath,
    '-i',
    vocalsPath,
    '-filter_complex',
    '[1:a]volume=1.10[v];[0:a][v]amix=inputs=2:weights=1 -1:duration=first:normalize=0,alimiter=limit=0.95',
    '-c:a',
    'pcm_s16le',
    instrumentalPath,
  ]);
}

async function processWithDemucs(sourcePath, jobDir, vocalsPath, instrumentalPath) {
  if (!DEMUCS_CMD) {
    throw new Error(
      'SEPARATION_ENGINE=demucs but DEMUCS_CMD is not configured in backend/.env',
    );
  }

  const demucsOutDir = path.join(jobDir, 'demucs-output');
  await fsp.mkdir(demucsOutDir, {recursive: true});
  const command = `${DEMUCS_CMD} --two-stems=vocals -o "${demucsOutDir}" "${sourcePath}"`;
  await runShellCommand(command);

  const demucsVocals = await findFirstFileRecursive(demucsOutDir, 'vocals.wav');
  const demucsNoVocals =
    (await findFirstFileRecursive(demucsOutDir, 'no_vocals.wav')) ||
    (await findFirstFileRecursive(demucsOutDir, 'accompaniment.wav'));

  if (!demucsVocals || !demucsNoVocals) {
    throw new Error(
      'Demucs finished but expected stems (vocals.wav / no_vocals.wav) were not found.',
    );
  }

  await Promise.all([
    fsp.copyFile(demucsVocals, vocalsPath),
    fsp.copyFile(demucsNoVocals, instrumentalPath),
  ]);
}

async function processJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) {
    return;
  }

  try {
    setJobState(jobId, {state: 'processing', progress: 0.1});
    const sourceWavPath = path.join(job.jobDir, 'source.wav');
    await convertToWav(job.sourcePath, sourceWavPath);

    setJobState(jobId, {progress: 0.7});
    const vocalsPath = path.join(job.jobDir, 'vocals.wav');
    const instrumentalPath = path.join(job.jobDir, 'instrumental.wav');

    if (SEPARATION_ENGINE === 'demucs') {
      try {
        await processWithDemucs(job.sourcePath, job.jobDir, vocalsPath, instrumentalPath);
        setJobState(jobId, {engine: 'demucs'});
      } catch (error) {
        // Reliability-first fallback to ffmpeg if demucs is unavailable.
        await processWithFfmpeg(sourceWavPath, vocalsPath, instrumentalPath);
        setJobState(jobId, {
          engine: 'ffmpeg',
          engineFallback:
            error instanceof Error ? error.message : 'demucs failed',
        });
      }
    } else {
      await processWithFfmpeg(sourceWavPath, vocalsPath, instrumentalPath);
      setJobState(jobId, {engine: 'ffmpeg'});
    }

    const stems = {
      vocalsUrl: `${PUBLIC_BASE_URL}/files/${jobId}/vocals.wav`,
      instrumentalUrl: `${PUBLIC_BASE_URL}/files/${jobId}/instrumental.wav`,
    };
    setJobState(jobId, {
      state: 'completed',
      progress: 1,
      stems,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    setJobState(jobId, {
      state: 'failed',
      progress: 1,
      error: error instanceof Error ? error.message : 'Unknown processing error',
    });
  }
}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
  },
});

app.use(cors());
app.use(express.json({limit: '1mb'}));
app.use(morgan('combined'));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    ffmpegAvailable: Boolean(ffmpegPath),
    separationEngine: SEPARATION_ENGINE,
    demucsConfigured: Boolean(DEMUCS_CMD),
    activeJobs: jobs.size,
  });
});

app.post('/v1/separation/jobs', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({error: 'Missing multipart file field "file"'});
    return;
  }

  const jobId = randomUUID();
  const originalName = safeBaseName(req.file.originalname || 'input.bin');
  const jobDir = path.join(JOBS_DIR, jobId);
  await fsp.mkdir(jobDir, {recursive: true});

  const sourcePath = path.join(jobDir, originalName);
  await fsp.rename(req.file.path, sourcePath);

  const now = new Date().toISOString();
  jobs.set(jobId, {
    jobId,
    state: 'queued',
    progress: 0,
    sourcePath,
    jobDir,
    createdAt: now,
    updatedAt: now,
  });

  setImmediate(() => {
    processJob(jobId).catch(() => {
      // Job failure state is handled in processJob.
    });
  });

  res.status(202).json({jobId});
});

app.get('/v1/separation/jobs/:jobId', requireAuth, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({error: 'Job not found'});
    return;
  }
  res.json(getJobResponse(job));
});

app.get('/files/:jobId/:name', requireAuth, async (req, res) => {
  const {jobId, name} = req.params;
  if (name !== 'vocals.wav' && name !== 'instrumental.wav') {
    res.status(404).end();
    return;
  }
  const filePath = path.join(JOBS_DIR, jobId, name);
  if (!fs.existsSync(filePath)) {
    res.status(404).end();
    return;
  }
  res.setHeader('Content-Type', 'audio/wav');
  res.sendFile(filePath);
});

async function bootstrap() {
  await ensureDirs();
  app.listen(PORT, HOST, () => {
    console.log(`Hybrid backend listening on http://${HOST}:${PORT}`);
  });
}

bootstrap().catch(error => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});

