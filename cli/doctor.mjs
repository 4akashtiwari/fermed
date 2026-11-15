#!/usr/bin/env node
/*
 * fermed doctor — environment preflight.
 *
 * Every "it won't run" report costs more than this file does. Run it once after
 * `npm install`, and in CI before anything else. It checks only things that
 * actually fail in practice, and every failure prints the exact command that
 * fixes it.
 *
 *   node cli/doctor.mjs [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { ROOT, launchBrowser, checkNetwork } from './lib/browser.mjs';

const run = promisify(execFile);
const json = process.argv.includes('--json');

const checks = [];
const add = (name, status, detail, fix) => checks.push({ name, status, detail, fix });

// ---------- 1. node -------------------------------------------------------
{
  const major = Number(process.versions.node.split('.')[0]);
  add('node', major >= 18 ? 'ok' : 'fail', `v${process.versions.node}`,
    'install Node 18 or newer (https://nodejs.org)');
}

// ---------- 2. dependencies ----------------------------------------------
{
  const required = ['three', 'gsap', 'lenis', 'zod', 'playwright', 'ffmpeg-static', 'vite'];
  const missing = required.filter((d) => !fs.existsSync(path.join(ROOT, 'node_modules', d)));
  add('dependencies', missing.length ? 'fail' : 'ok',
    missing.length ? `missing: ${missing.join(', ')}` : `${required.length} packages present`,
    'run: npm install');
}

// ---------- 3. chromium ---------------------------------------------------
let browser = null;
try {
  browser = await launchBrowser();
  add('chromium', 'ok', 'launches (software WebGL available)', null);
} catch (err) {
  add('chromium', 'fail', err.message.split('\n')[0],
    'npx playwright install chromium  (plus the system libs listed in README → Troubleshooting)');
}

// ---------- 4. webgl parity ----------------------------------------------
if (browser) {
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
    const gl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('webgl2');
      if (!ctx) return null;
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
      return {
        version: ctx.getParameter(ctx.VERSION),
        renderer: dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
        maxTexture: ctx.getParameter(ctx.MAX_TEXTURE_SIZE),
      };
    });
    await page.close();
    add('webgl2', gl ? 'ok' : 'fail',
      gl ? `${gl.renderer} · max texture ${gl.maxTexture}` : 'WebGL2 context unavailable',
      gl ? null : 'Chromium is launching without software GL. Check that --use-angle=swiftshader is not being overridden by a policy.');
  } catch (err) {
    add('webgl2', 'fail', err.message, 'reinstall Chromium: npx playwright install --force chromium');
  }
}

// ---------- 5. ffmpeg -----------------------------------------------------
{
  try {
    const mod = await import('ffmpeg-static');
    const bin = mod.default;
    const exists = bin && fs.existsSync(bin);
    if (exists) {
      const { stdout } = await run(bin, ['-version']);
      const line = stdout.split('\n')[0];
      add('ffmpeg', 'ok', line.slice(0, 90), null);
    } else {
      const { stdout } = await run('ffmpeg', ['-version']);
      add('ffmpeg', 'warn', `bundled binary missing, system ffmpeg found: ${stdout.split('\n')[0].slice(0, 60)}`,
        'works, but pin the version: reinstall with npm install ffmpeg-static');
    }
  } catch {
    add('ffmpeg', 'fail', 'no usable ffmpeg', 'npm install ffmpeg-static  (or install ffmpeg system-wide)');
  }
}

// ---------- 6. h264 encoder ----------------------------------------------
{
  try {
    const mod = await import('ffmpeg-static');
    const bin = mod.default && fs.existsSync(mod.default) ? mod.default : 'ffmpeg';
    const { stdout } = await run(bin, ['-hide_banner', '-encoders']);
    const has264 = /libx264/.test(stdout);
    add('encoder', has264 ? 'ok' : 'fail', has264 ? 'libx264 available' : 'libx264 missing from this ffmpeg build',
      has264 ? null : 'install an ffmpeg build with libx264, or reinstall ffmpeg-static');
  } catch (err) {
    add('encoder', 'warn', `could not query encoders: ${err.message.split('\n')[0]}`, null);
  }
}

// ---------- 7. disk space -------------------------------------------------
{
  try {
    const { stdout } = await run('df', ['-k', ROOT]);
    const kb = Number(stdout.trim().split('\n').pop().split(/\s+/)[3]);
    const gb = kb / 1024 / 1024;
    add('disk', gb > 3 ? 'ok' : gb > 1 ? 'warn' : 'fail',
      `${gb.toFixed(1)} GB free`,
      gb > 3 ? null : 'a 25s 1080p film writes ~1–2 GB of intermediate frames; free some space or use --preset medium / --size 1280x720');
  } catch {
    add('disk', 'warn', 'could not read free space', null);
  }
}

// ---------- 8. memory -----------------------------------------------------
{
  const total = Math.round((await import('node:os')).totalmem() / 1e9);
  add('memory', total >= 4 ? 'ok' : 'warn', `${total} GB RAM`,
    total >= 4 ? null : 'below 4 GB: render at 1280×720 and avoid --keep-frames; long 1080p renders can be starved by the OS');
}

// ---------- 9. repo shape -------------------------------------------------
{
  const need = ['engine/player.js', 'cli/render.mjs', 'specs/_template.json', 'skill/fermi-visual-line/SKILL.md'];
  const missing = need.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  add('repo', missing.length ? 'fail' : 'ok',
    missing.length ? `missing: ${missing.join(', ')}` : 'engine, cli, specs and skill present',
    'run from a complete checkout of the Fermed repo');
}

// ---------- 10. specs -----------------------------------------------------
{
  try {
    const { validateSpec } = await import('../engine/schema.js');
    const dir = path.join(ROOT, 'specs');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_template.json');
    const bad = [];
    for (const f of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const { ok, errors } = validateSpec(raw);
      if (!ok) bad.push(`${f} (${errors.length})`);
    }
    add('specs', bad.length ? 'fail' : 'ok',
      bad.length ? `invalid: ${bad.join(', ')}` : `${files.length} specs valid`,
      bad.length ? 'node cli/validate.mjs specs/<file>' : null);
  } catch (err) {
    add('specs', 'warn', `could not check specs: ${err.message.split('\n')[0]}`, null);
  }
}

// ---------- 11. network (warn only) --------------------------------------
{
  const net = await checkNetwork();
  add('network', net.ok ? 'ok' : 'warn', net.detail,
    net.ok ? null : 'offline is fine for rendering, but npm install and browser downloads need a connection');
}

if (browser) await browser.close();

// ---------- report --------------------------------------------------------
const fails = checks.filter((c) => c.status === 'fail');
const warns = checks.filter((c) => c.status === 'warn');

if (json) {
  console.log(JSON.stringify({ ok: fails.length === 0, checks }, null, 2));
} else {
  const icon = { ok: '✓', warn: '!', fail: '✗' };
  console.log('\nFermed environment\n');
  for (const c of checks) {
    console.log(`  ${icon[c.status]} ${c.name.padEnd(13)} ${c.detail}`);
    if (c.status !== 'ok' && c.fix) console.log(`    ${' '.repeat(13)} → ${c.fix}`);
  }
  console.log('');
  if (fails.length) {
    console.log(`✗ ${fails.length} blocking problem(s). Fix those and re-run: node cli/doctor.mjs\n`);
  } else if (warns.length) {
    console.log(`✓ ready to render (${warns.length} warning(s))\n`);
  } else {
    console.log('✓ everything checks out — try: node cli/render.mjs specs/demo.json --stills 0.5\n');
  }
}

process.exit(fails.length ? 1 : 0);
