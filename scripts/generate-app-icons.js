/**
 * Generate Android launcher icons from a single master image.
 *
 * Reads `assets/app_icon_master.png`, center-crops it to a 1024×1024 square,
 * then writes the resized variants required by Android into the project's
 * `android/app/src/main/res/mipmap-*` directories.
 *
 * Outputs per density:
 *   - ic_launcher.png        (square legacy icon)
 *   - ic_launcher_round.png  (round legacy icon — circle-masked variant)
 *   - ic_launcher_foreground.png  (adaptive icon foreground for Android 8+)
 *
 * Adaptive icon XML descriptors and the background color live alongside this
 * script in `android/app/src/main/res/mipmap-anydpi-v26/` and
 * `android/app/src/main/res/values/`. This script only refreshes the bitmaps.
 *
 * Usage: node scripts/generate-app-icons.js
 */

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'app_icon_master.png');
const RES_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

const DENSITIES = [
  {dir: 'mipmap-mdpi', size: 48, fgSize: 108},
  {dir: 'mipmap-hdpi', size: 72, fgSize: 162},
  {dir: 'mipmap-xhdpi', size: 96, fgSize: 216},
  {dir: 'mipmap-xxhdpi', size: 144, fgSize: 324},
  {dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432},
];

const MASTER_SIZE = 1024;

function buildCircleMask(size) {
  const r = size / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${r}" cy="${r}" r="${r}" fill="white"/>` +
      `</svg>`,
  );
}

async function loadMasterSquare() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source icon not found at ${SOURCE}`);
  }

  const meta = await sharp(SOURCE).metadata();
  const side = Math.min(meta.width, meta.height);
  const left = Math.floor((meta.width - side) / 2);
  const top = Math.floor((meta.height - side) / 2);

  return sharp(SOURCE)
    .extract({left, top, width: side, height: side})
    .resize(MASTER_SIZE, MASTER_SIZE, {fit: 'cover'})
    .png()
    .toBuffer();
}

async function writeSquareIcon(masterBuffer, outPath, size) {
  await sharp(masterBuffer)
    .resize(size, size, {fit: 'cover'})
    .png({compressionLevel: 9})
    .toFile(outPath);
}

async function writeRoundIcon(masterBuffer, outPath, size) {
  const mask = buildCircleMask(size);
  const base = await sharp(masterBuffer)
    .resize(size, size, {fit: 'cover'})
    .png()
    .toBuffer();
  await sharp(base)
    .composite([{input: mask, blend: 'dest-in'}])
    .png({compressionLevel: 9})
    .toFile(outPath);
}

/**
 * Adaptive icon foreground: focal element on transparent background, sized so
 * the visual content stays inside the central 66% safe zone after the launcher
 * applies its mask. We scale the master to ~72% of the canvas and center it on
 * a transparent square sized to the density's foreground dimension.
 */
async function writeAdaptiveForeground(masterBuffer, outPath, size) {
  const focal = Math.round(size * 0.72);
  const focalPng = await sharp(masterBuffer)
    .resize(focal, focal, {fit: 'cover'})
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  })
    .composite([
      {
        input: focalPng,
        left: Math.round((size - focal) / 2),
        top: Math.round((size - focal) / 2),
      },
    ])
    .png({compressionLevel: 9})
    .toFile(outPath);
}

async function main() {
  console.log(`Reading source: ${SOURCE}`);
  const master = await loadMasterSquare();
  console.log(`Center-cropped to ${MASTER_SIZE}×${MASTER_SIZE}`);

  for (const d of DENSITIES) {
    const outDir = path.join(RES_DIR, d.dir);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, {recursive: true});
    }

    const square = path.join(outDir, 'ic_launcher.png');
    const round = path.join(outDir, 'ic_launcher_round.png');
    const foreground = path.join(outDir, 'ic_launcher_foreground.png');

    await writeSquareIcon(master, square, d.size);
    await writeRoundIcon(master, round, d.size);
    await writeAdaptiveForeground(master, foreground, d.fgSize);

    console.log(
      `  ${d.dir.padEnd(16)}  legacy=${d.size}×${d.size}  foreground=${d.fgSize}×${d.fgSize}`,
    );
  }

  console.log('\nDone. Rebuild the Android app to see the new icon.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
