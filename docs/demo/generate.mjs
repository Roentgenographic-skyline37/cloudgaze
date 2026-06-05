// Renders docs/demo.gif from demo.html by driving the locally-installed Chrome
// through a deterministic time-seek timeline (window.__seek(t)). Dev-only; not
// part of the app build.
//
//   npm install         # puppeteer-core, gifenc, pngjs
//   node generate.mjs preview 0.6 1.6 3.4 5.0 9.0 14.0   # save PNGs to verify
//   node generate.mjs gif                                # render ../demo.gif
//
// Env overrides: FPS, W, H, COLORS, OUT, CHROME
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = 'file://' + join(__dirname, 'demo.html').replace(/\\/g, '/');

const FPS = +(process.env.FPS || 12);
const W = +(process.env.W || 1180);
const H = +(process.env.H || 720);
const COLORS = +(process.env.COLORS || 192);
const OUT = process.env.OUT || join(__dirname, '..', 'demo.gif');

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ];
  for (const c of candidates) if (c && existsSync(c)) return c;
  throw new Error('No Chrome/Edge found; set CHROME=/path/to/chrome.exe');
}

async function launch() {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(HTML, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true', { timeout: 20000 });
  const duration = await page.evaluate('window.__DURATION');
  return { browser, page, duration };
}

async function frameBuffer(page, t) {
  await page.evaluate((tt) => window.__seek(tt), t);
  return await page.screenshot({ type: 'png' });
}

async function preview(times) {
  const { browser, page } = await launch();
  for (const t of times) {
    const buf = await frameBuffer(page, t);
    const f = join(__dirname, `preview-${String(t).replace('.', '_')}.png`);
    writeFileSync(f, buf);
    console.log('wrote', f);
  }
  await browser.close();
}

async function gif() {
  const { browser, page, duration } = await launch();
  const total = Math.round(duration * FPS);
  const delay = Math.round(1000 / FPS);
  const enc = GIFEncoder();
  console.log(`rendering ${total} frames @ ${FPS}fps, ${W}x${H}, <=${COLORS} colors`);
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    const buf = await frameBuffer(page, t);
    const png = PNG.sync.read(Buffer.from(buf));
    const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
    const palette = quantize(rgba, COLORS, { format: 'rgb565' });
    const index = applyPalette(rgba, palette, 'rgb565');
    enc.writeFrame(index, png.width, png.height, { palette, delay });
    if (i % 20 === 0) process.stdout.write(`  ${i}/${total}\r`);
  }
  enc.finish();
  writeFileSync(OUT, Buffer.from(enc.bytes()));
  const kb = (Buffer.from(enc.bytes()).length / 1024).toFixed(0);
  console.log(`\nwrote ${OUT} (${kb} KB)`);
  await browser.close();
}

const mode = process.argv[2];
if (mode === 'preview') {
  const times = process.argv.slice(3).map(Number);
  preview(times.length ? times : [0.6, 1.6, 3.4, 5.0, 9.0, 14.0]).catch((e) => { console.error(e); process.exit(1); });
} else if (mode === 'gif') {
  gif().catch((e) => { console.error(e); process.exit(1); });
} else {
  console.log('usage: node generate.mjs preview [t ...] | gif');
  process.exit(1);
}
