#!/usr/bin/env node
/*
 * fermed render — spec in, MP4 out.
 *
 * How it works (and why it can be trusted):
 *   1. Vite builds the site (or serves it from a temp preview server).
 *   2. Playwright opens it in Chromium with `?mode=render`. In that mode the
 *      player skips scroll entirely and exposes `window.__fermed.seek(t)`.
 *   3. Node walks t from 0→1 on a fixed fps clock, calling seek() and grabbing
 *      each composited frame. Because seek() is the same code path the website
 *      uses, the video is the site.
 *   4. ffmpeg (bundled, no system install) encodes the frame sequence.
 *
 * Usage:
 *   fermed render <spec> [options]
 *
 *   --out <file>        output path                     (default: out/<slug>.mp4)
 *   --size <WxH>        frame size (overrides spec)     (default: from spec)
 *   --fps <n>           frames per second               (default: from spec)
 *   --scale <n>         CSS scale multiplier            (default: 1)
 *   --from <t>          start progress 0..1             (default: 0)
 *   --to <t>            end progress 0..1               (default: 1)
 *   --stills <a,b,c>    only write PNG stills at these progresses, no video
 *   --poster            also write a poster PNG (68% through, see --poster-at)
 *   --poster-at <t>     poster position 0..1
 *   --crf <n>           x264 quality, lower = better    (default: 18)
 *   --preset <name>     x264 preset                     (default: slow)
 *   --keep-frames       keep the PNG sequence
 *   --url <base>        render a running server instead of building
 *   --verbose           print per-frame timings
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { validateSpec } from '../engine/schema.js';
import { resolveScrollEase } from '../engine/easings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------- tiny arg parser ------------------------------------------------
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const specPath = args._[0];

if (!specPath || args.help) {
  console.log(`Fermed render

  node cli/render.mjs <spec.json> [--out file.mp4] [--size 1920x1080] [--fps 30]
                                 [--stills 0.1,0.5,0.9] [--poster] [--url http://…]
`);
  process.exit(specPath ? 0 : 1);
}

const verbose = !!args.verbose;
const log = (...a) => console.log('[fermed]', ...a);
const vlog = (...a) => verbose && console.log('[fermed]', ...a);
const fmtBytes = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e3).toFixed(0)} KB`);

async function main() {
  const started = Date.now();

  // ---- spec ---------------------------------------------------------------
  const absSpec = path.resolve(process.cwd(), specPath);
  const raw = JSON.parse(await fs.readFile(absSpec, 'utf8'));
  const { ok, errors, spec } = validateSpec(raw);
  if (!ok) {
    console.error('[fermed] spec is invalid:');
    for (const e of errors) console.error(`  · ${e.path}: ${e.message}`);
    process.exit(2);
  }

  const slug = spec.meta.slug;
  const W = Number(args.size?.split('x')[0]) || spec.render.width;
  const H = Number(args.size?.split('x')[1]) || spec.render.height;
  const fps = Number(args.fps) || spec.render.fps;
  const scale = Number(args.scale) || 1;

  // ---- where the site comes from -----------------------------------------
  let baseUrl = args.url;
  let server = null;

  if (!baseUrl) {
    baseUrl = await startPreview();
    server = stopServer;
  }

  // ---- browser ------------------------------------------------------------
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--disable-lcd-text',
      '--font-render-hinting=none',
    ],
  });

  const page = await browser.newPage({
    viewport: { width: Math.round(W * scale), height: Math.round(H * scale) },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });

  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[page]', m.text());
  });
  page.on('pageerror', (e) => console.error('[page:error]', e.message));

  const url = `${baseUrl}/index.html?spec=${encodeURIComponent(specUrlFor(absSpec))}&mode=render`;
  log(`opening ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });

  // wait for the engine (and its fonts) to be ready
  await page.waitForFunction(() => window.__fermed?.ready === true, { timeout: 60_000 });
  const info = await page.evaluate(() => ({
    duration: window.__fermed.duration,
    scenes: window.__fermed.scenes.length,
    styleset: window.__fermed.styleset,
    gl: (() => {
      const gl = document.querySelector('canvas')?.getContext('webgl2');
      const d = gl?.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
    })(),
  }));
  log(`spec ok · "${spec.meta.title}" · ${info.scenes} scenes · ${info.duration.toFixed(1)}s · styleset ${info.styleset}`);
  vlog(`webgl: ${info.gl}`);

  await page.evaluate(() => document.fonts?.ready?.then?.(() => true));
  await page.waitForTimeout(250); // one paint after fonts settle

  // ---- frames -------------------------------------------------------------
  const framesDir = path.join(os.tmpdir(), `fermed-${slug}-${Date.now()}`);
  await fs.mkdir(framesDir, { recursive: true });

  const stills = args.stills
    ? String(args.stills).split(',').map((n) => {
      const v = Number(n);
      if (Number.isNaN(v)) throw new Error(`--stills expects numbers, got "${n}"`);
      return Math.min(1, Math.max(0, v));
    })
    : null;

  const from = Math.max(0, Number(args.from ?? 0));
  const to = Math.min(1, Number(args.to ?? 1));
  const duration = info.duration;
  const frameCount = Math.max(2, Math.round(duration * (to - from) * fps));

  const frames = [];
  const t0 = Date.now();

  if (stills) {
    const outDir = path.resolve(process.cwd(), args.out ? path.dirname(args.out) : 'out');
    await fs.mkdir(outDir, { recursive: true });
    for (const [i, t] of stills.entries()) {
      await page.evaluate((tt) => window.__fermed.seek(tt), t);
      await page.waitForTimeout(60);
      const file = path.join(outDir, `${slug}-still-${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: file, type: 'png' });
      log(`still ${t.toFixed(2)} → ${path.relative(process.cwd(), file)}`);
    }
    await browser.close();
    await server?.();
    return;
  }

  for (let f = 0; f < frameCount; f++) {
    const linear = from + (to - from) * (f / (frameCount - 1));
    // Scroll pacing: real scroll input is eased, so the video should be too.
    const t = from + (to - from) * resolveScrollEase(spec.export.scrollEase)((linear - from) / (to - from || 1));

    await page.evaluate((tt) => window.__fermed.seek(tt), t);
    const buf = await page.screenshot({ type: 'png' });
    await fs.writeFile(path.join(framesDir, `f${String(f).padStart(5, '0')}.png`), buf);
    if (f % 10 === 0 || f === frameCount - 1) {
      const pct = ((f / (frameCount - 1)) * 100).toFixed(0);
      const rate = (Date.now() - t0) / (f + 1);
      process.stdout.write(`\r[fermed] capturing ${pct.padStart(3)}%  ${f + 1}/${frameCount}  ${rate.toFixed(0)}ms/frame   `);
    }
  }
  process.stdout.write('\n');
  const captureSec = (Date.now() - t0) / 1000;
  log(`captured ${frameCount} frames in ${captureSec.toFixed(1)}s (${(frameCount / captureSec).toFixed(1)} fps)`);

  // ---- poster -------------------------------------------------------------
  const outPath = path.resolve(process.cwd(), args.out || `out/${slug}.mp4`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  if (args.poster) {
    // The most representative frame is rarely the midpoint: the first half is
    // setup, so posters land in the back half by default. Override with
    // --poster-at <0..1>.
    const at = Math.min(1, Math.max(0, Number(args['poster-at'] ?? 0.68)));
    const idx = Math.round(at * (frameCount - 1));
    await fs.copyFile(
      path.join(framesDir, `f${String(idx).padStart(5, '0')}.png`),
      outPath.replace(/\.\w+$/, '-poster.png'),
    );
  }

  // ---- encode -------------------------------------------------------------
  const ffmpegPath = await resolveFfmpeg();
  const crf = String(args.crf ?? spec.export.crf ?? 18);
  const preset = String(args.preset ?? spec.export.preset ?? 'slow');

  const ffArgs = [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'f%05d.png'),
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', crf,
    '-tune', 'film',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-colorspace', 'bt709',
    outPath,
  ];

  // optional music bed
  const musicSrc = spec.music?.src;
  if (musicSrc) {
    const musicPath = path.resolve(path.dirname(absSpec), musicSrc);
    try {
      await fs.access(musicPath);
      ffArgs.splice(ffArgs.length - 1, 0,
        '-i', musicPath,
        '-filter_complex', `[1:a]volume=${spec.music.volume ?? 0.6},afade=t=in:st=0:d=${spec.music.fadeIn ?? 1},afade=t=out:st=${Math.max(0, duration - (spec.music.fadeOut ?? 1.5))}:d=${spec.music.fadeOut ?? 1.5}[a]`,
        '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', '-shortest');
      log(`music: ${path.relative(process.cwd(), musicPath)}`);
    } catch {
      console.warn(`[fermed] music file not found: ${musicSrc} — rendering silent`);
    }
  }

  log(`encoding → ${path.relative(process.cwd(), outPath)} (h264, crf ${crf}, ${preset})`);
  await run(ffmpegPath, ffArgs);

  const stat = await fs.stat(outPath);
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  log(`done · ${path.relative(process.cwd(), outPath)} · ${fmtBytes(stat.size)} · ${duration.toFixed(1)}s video · ${secs}s total`);

  if (!args['keep-frames']) await fs.rm(framesDir, { recursive: true, force: true });
  else log(`frames kept at ${framesDir}`);

  await browser.close();
  await server?.();
}

// ---------- helpers -------------------------------------------------------
function specUrlFor(absSpec) {
  const rel = path.relative(ROOT, absSpec).split(path.sep).join('/');
  return rel.startsWith('..') ? `file://${absSpec}` : `/${rel}`;
}

async function resolveFfmpeg() {
  try {
    const mod = await import('ffmpeg-static');
    const p = mod.default;
    if (p) {
      await fs.access(p);
      return p;
    }
  } catch { /* fall through to system ffmpeg */ }
  return 'ffmpeg';
}

function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

/** Build once, serve statically on a free port. */
async function startPreview() {
  const { createServer } = await import('vite');
  log('building site…');
  const vite = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.js'),
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error',
  });
  await vite.listen();
  const port = vite.config.server.port;
  return `http://127.0.0.1:${port}`;
}

let stopServer = null;

main().catch((err) => {
  console.error('[fermed] render failed:', err.message);
  if (verbose) console.error(err.stack);
  process.exit(1);
});
