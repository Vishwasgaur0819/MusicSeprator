/* eslint-disable no-console */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:8787';
const TOKEN = process.env.API_TOKEN || '';
const INPUT_FILE = process.argv[2];
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS || 180000);
const POLL_MS = Number(process.env.E2E_POLL_MS || 2000);

function authHeaders() {
  if (!TOKEN) {
    return {};
  }
  return {Authorization: `Bearer ${TOKEN}`};
}

function assertInput() {
  if (!INPUT_FILE) {
    throw new Error(
      'Usage: node scripts/e2e-cloud.js "<path-to-audio-file>"',
    );
  }
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}`);
  }
}

async function startJob() {
  const buffer = await fsp.readFile(INPUT_FILE);
  const form = new FormData();
  form.append(
    'file',
    new Blob([buffer], {type: 'audio/mpeg'}),
    path.basename(INPUT_FILE),
  );

  const response = await fetch(`${BASE_URL}/v1/separation/jobs`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
    },
    body: form,
  });
  if (!response.ok) {
    throw new Error(
      `Job start failed: HTTP ${response.status} ${await response.text()}`,
    );
  }
  const body = await response.json();
  if (!body.jobId) {
    throw new Error('Job start response missing jobId');
  }
  return body.jobId;
}

async function pollJob(jobId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const response = await fetch(`${BASE_URL}/v1/separation/jobs/${jobId}`, {
      headers: {
        Accept: 'application/json',
        ...authHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error(`Status failed: HTTP ${response.status}`);
    }
    const body = await response.json();
    const pct =
      typeof body.progress === 'number' ? Math.round(body.progress * 100) : 0;
    console.log(`state=${body.state} progress=${pct}%`);

    if (body.state === 'completed') {
      if (!body.stems?.vocalsUrl || !body.stems?.instrumentalUrl) {
        throw new Error('Completed job missing stems URLs');
      }
      return body.stems;
    }
    if (body.state === 'failed') {
      throw new Error(`Job failed: ${body.error || 'unknown error'}`);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`Timeout waiting for completion after ${TIMEOUT_MS}ms`);
}

async function downloadFile(url, outPath) {
  const response = await fetch(url, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Download failed (${url}) HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fsp.writeFile(outPath, Buffer.from(arrayBuffer));
}

async function main() {
  assertInput();
  const jobId = await startJob();
  console.log(`jobId=${jobId}`);
  const stems = await pollJob(jobId);

  const outDir = path.resolve('e2e-output', jobId);
  await fsp.mkdir(outDir, {recursive: true});
  const vocalsPath = path.join(outDir, 'vocals.wav');
  const instrumentalPath = path.join(outDir, 'instrumental.wav');
  await downloadFile(stems.vocalsUrl, vocalsPath);
  await downloadFile(stems.instrumentalUrl, instrumentalPath);

  console.log('E2E success');
  console.log(`vocals=${vocalsPath}`);
  console.log(`instrumental=${instrumentalPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

