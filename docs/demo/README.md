# Demo GIF generator

`../demo.gif` (shown in the project README) is rendered from **`demo.html`** — a
self-contained, **mock-data** recreation of CloudGaze's Deployed dashboard. It
reuses the app's real theme tokens, Tailwind classes, lucide icon names, and
chart styling, but every account ID, resource, and metric is fictional. **No real
AWS account is ever involved.**

`demo.html` exposes a deterministic timeline — `window.__seek(t)` positions the
entire scene (stat count-up, chart draw-in, scroll, detail drawer, dark↔light
theme crossfade) for any time `t`. That lets the renderer produce perfectly
smooth frames regardless of screenshot timing.

## Regenerate

```bash
cd docs/demo
npm install                 # puppeteer-core, gifenc, pngjs, gifsicle
node generate.mjs preview   # save a few PNG frames to eyeball fidelity
node generate.mjs gif       # render ../demo.gif (raw)

# optimize (inter-frame diffing + lossy) — ~11 MB -> ~3.8 MB
node_modules/gifsicle/vendor/gifsicle.exe -O3 --lossy=60 --colors 128 ../demo.gif -o ../demo.gif
```

`generate.mjs` drives the locally-installed Chrome (override with `CHROME=`),
calls `__seek(t)` per frame, and encodes with `gifenc`. Tunables via env:
`FPS`, `W`, `H`, `COLORS`, `OUT`.

> Dev-only tooling. It is not part of the app build and ships nothing into the
> packaged binaries.
