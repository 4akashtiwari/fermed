#!/usr/bin/env node
/*
 * fermed check:layout — prove no type collides, clips, or overflows.
 *
 * The two rules the style linter could only gesture at ("no copy collisions",
 * "nothing clips the frame edge") become mechanical here: open the built site in
 * render mode, walk the story at N points, and ask the live DOM where every
 * visible copy block actually landed. Then test the boxes pairwise and against
 * the safe area, at every requested aspect.
 *
 *   node cli/check-layout.mjs <spec.json> [--aspects 16:9,9:16,1:1]
 *                                         [--points 12] [--strict] [--json]
 *
 * Exit 1 on errors (or on warnings with --strict).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { validateSpec } from '../engine/schema.js';
import { ASPECT_PRESETS, aspectSize } from '../engine/aspects.js';
import { detectLayoutIssues, formatIssues } from '../engine/framecheck.js';
import { launchBrowser, buildAndServe, openRenderPage, ROOT } from './lib/browser.mjs';

// ---------- args -----------------------------------------------------------
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; } else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const specPath = args._[0];
if (!specPath || args.help) {
  console.log('usage: node cli/check-layout.mjs <spec.json> [--aspects 16:9,9:16] [--points 12] [--strict] [--json]');
  process.exit(specPath ? 0 : 1);
}

const strict = !!args.strict;
const json = !!args.json;
const points = Math.max(3, Number(args.points) || 12);

async function main() {
  const absSpec = path.resolve(process.cwd(), specPath);
  const raw = JSON.parse(await fs.readFile(absSpec, 'utf8'));
  const { ok, errors: schemaErrors, spec } = validateSpec(raw);
  if (!ok) {
    console.error('[fermed] spec is invalid — run validate first:');
    for (const e of schemaErrors) console.error(`  · ${e.path}: ${e.message}`);
    process.exit(2);
  }

  // Which frames to test: explicit list, else the spec's own size, else 16:9.
  const aspectList = args.aspects
    ? String(args.aspects).split(',').map((s) => s.trim()).filter(Boolean)
    : [Object.entries(ASPECT_PRESETS).find(([, v]) => v.width === spec.render.width && v.height === spec.render.height)?.[0]
      || `${spec.render.width / gcd(spec.render.width, spec.render.height)}:${spec.render.height / gcd(spec.render.width, spec.render.height)}`];

  const server = await buildAndServe();
  const browser = await launchBrowser();
  const relSpec = '/' + path.relative(ROOT, absSpec).split(path.sep).join('/');

  const results = [];
  try {
    for (const aspect of aspectList) {
      const size = aspectSize(aspect) || { width: spec.render.width, height: spec.render.height };
      // Test at a reviewable resolution, keeping the aspect exact.
      const long = 1080;
      const scale = long / Math.max(size.width, size.height);
      const viewport = {
        width: Math.round(size.width * scale),
        height: Math.round(size.height * scale),
      };

      const { page, errors: pageErrors } = await openRenderPage(browser, server.url, relSpec, viewport);
      if (pageErrors.length) {
        console.error(`[fermed] page errors while checking ${aspect}:`);
        for (const e of pageErrors.slice(0, 4)) console.error('  ·', e);
      }

      const found = [];
      for (let i = 0; i < points; i++) {
        const t = points === 1 ? 0 : i / (points - 1);
        const shot = await page.evaluate((tt) => {
          window.__fermed.seek(tt);
          // The overlay writes geometry synchronously; measure after a frame.
          return new Promise((resolve) => requestAnimationFrame(() => {
            resolve({ audit: window.__fermed.audit(), t: tt, scene: window.__fermed.sample(tt).sceneIndex });
          }));
        }, t);

        for (const issue of shot.audit) {
          found.push({ ...issue, t, scene: shot.scene, aspect });
        }
      }

      // Collapse duplicates (same pair of ids colliding at many timestamps).
      const seen = new Map();
      for (const issue of found) {
        const key = `${issue.kind}:${issue.ids.slice().sort().join('|')}`;
        const prev = seen.get(key);
        if (!prev) seen.set(key, { ...issue, count: 1, times: [issue.t] });
        else {
          prev.count++;
          prev.times.push(issue.t);
          if (issue.severity === 'error') prev.severity = 'error';
        }
      }
      results.push({ aspect, viewport, issues: [...seen.values()], pageErrors });
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  if (json) {
    console.log(JSON.stringify({ spec: spec.meta.slug, points, results }, null, 2));
  } else {
    for (const r of results) {
      const label = `${spec.meta.slug} @ ${r.aspect} (${r.viewport.width}×${r.viewport.height}) · ${points} story points\n`;
      if (!r.issues.length) {
        console.log(`${label}  ✓ no collisions, no clipping, no slot overflow`);
        continue;
      }
      console.log(label + formatIssues(r.issues.map((i) => ({
        ...i,
        message: `${i.message} [${i.count === 1 ? '1 point' : `${i.count} points`}, first at t=${i.times[0].toFixed(2)}, scene ${i.scene + 1}]`,
      }))));
    }
  }

  const errCount = results.flatMap((r) => r.issues).filter((i) => i.severity === 'error').length;
  const warnCount = results.flatMap((r) => r.issues).filter((i) => i.severity === 'warn').length;
  if (errCount) process.exit(1);
  if (warnCount && strict) process.exit(1);
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

main().catch((err) => {
  console.error('[fermed] layout check failed:', err.message);
  process.exit(1);
});
