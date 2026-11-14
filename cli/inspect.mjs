#!/usr/bin/env node
/* fermed inspect — dump what the timeline actually computes, per second. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateSpec } from '../engine/schema.js';
import { buildTimeline } from '../engine/timeline.js';

const file = process.argv[2];
if (!file) { console.error('usage: node cli/inspect.mjs <spec.json> [--json]'); process.exit(1); }

const raw = JSON.parse(await fs.readFile(path.resolve(process.cwd(), file), 'utf8'));
const { ok, errors, spec } = validateSpec(raw);
if (!ok) { for (const e of errors) console.error(`· ${e.path}: ${e.message}`); process.exit(1); }

const tl = buildTimeline(spec);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total: tl.total, theme: tl.theme.name, scenes: tl.scenes }, null, 2));
  process.exit(0);
}

const rows = [];
const steps = 10;
for (let i = 0; i <= steps; i++) {
  const s = tl.sample(i / steps);
  const { meta } = tl.sceneAt(i / steps);
  rows.push({
    't%': (s.t01 * 100).toFixed(0),
    sec: s.tSec.toFixed(2),
    scene: `${s.sceneIndex + 1}:${meta.id}`,
    'local%': (s.sceneProgress * 100).toFixed(0),
    'cam xyz': s.camera.position.map((v) => v.toFixed(2)).join(', '),
    fov: s.camera.fov.toFixed(0),
    veil: s.veil.toFixed(2),
    'visible els': Object.values(s.elements).filter((e) => e.opacity > 0.01).length,
    'visible copy': Object.values(s.copies).filter((c) => c.opacity > 0.01).length,
  });
}
console.log(`total ${tl.total.toFixed(2)}s · styleset ${tl.theme.name}`);
console.table(rows);
