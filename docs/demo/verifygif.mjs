// Quick visual check of a rendered GIF: opens it in Chrome and screenshots the
// animated image at given elapsed-times (ms). node verifygif.mjs <gif> <ms...>
import puppeteer from 'puppeteer-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, existsSync } from 'node:fs';
const __dirname = dirname(fileURLToPath(import.meta.url));

function findChrome() {
  const c = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'];
  for (const p of c) if (existsSync(p)) return p;
  throw new Error('no chrome');
}
const gif = process.argv[2] || join(__dirname, '..', 'demo-opt.gif');
const times = (process.argv.slice(3).map(Number));
const url = 'file://' + gif.replace(/\\/g, '/');
const b = await puppeteer.launch({ executablePath: findChrome(), headless: 'new',
  defaultViewport: { width: 1180, height: 720 }, args: ['--no-sandbox', '--force-color-profile=srgb'] });
const p = await b.newPage();
await p.goto(url, { waitUntil: 'load' });
const start = Date.now();
for (const ms of times) {
  const wait = ms - (Date.now() - start);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const f = join(__dirname, `check-${ms}.png`);
  writeFileSync(f, await p.screenshot({ type: 'png' }));
  console.log('wrote', f);
}
await b.close();
