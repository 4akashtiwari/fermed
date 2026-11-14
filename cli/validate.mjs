#!/usr/bin/env node
/* fermed validate — check a spec against the schema and print the storyboard. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateSpec, storyboard } from '../engine/schema.js';
import { resolveTheme } from '../engine/stylesets.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: node cli/validate.mjs <spec.json>');
  process.exit(1);
}

const raw = JSON.parse(await fs.readFile(path.resolve(process.cwd(), file), 'utf8'));
const { ok, errors, spec } = validateSpec(raw);

if (!ok) {
  console.error(`✗ ${file} — ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  · ${e.path}\n    ${e.message}`);
  process.exit(1);
}

const theme = resolveTheme(spec);
const total = spec.scenes.reduce((n, s) => n + s.duration, 0);
const elements = spec.scenes.reduce((n, s) => n + s.elements.length, 0);
const copyCount = spec.scenes.reduce((n, s) => n + s.copy.length, 0);

console.log(`✓ ${file} is valid\n`);
console.log(`  title      ${spec.meta.title}`);
console.log(`  styleset   ${theme.name} — ${theme.label}`);
console.log(`  runtime    ${total.toFixed(1)}s · ${spec.scenes.length} scenes · ${elements} elements · ${copyCount} copy blocks`);
console.log(`  render     ${spec.render.width}×${spec.render.height} @ ${spec.render.fps}fps · ${spec.export.format} crf ${spec.export.crf}`);
console.log(`  scroll     ${spec.scroll.pxPerSecond}px/s → ${Math.round(total * spec.scroll.pxPerSecond)}px page\n`);

console.table(storyboard(spec).map((s) => ({
  '#': s['#'],
  scene: s.id,
  timecode: s.timecode,
  dur: `${s.duration}s`,
  el: s.elements,
  copy: s.copy.length,
  transition: s.transition,
})));

const warnings = [];
for (const [i, s] of spec.scenes.entries()) {
  if (!s.copy.length) warnings.push(`scene ${i + 1} (${s.id}) has no copy — it will read as motion only`);
  if (!s.camera) warnings.push(`scene ${i + 1} (${s.id}) has no camera block — it will inherit the previous scene's end`);
  if (s.duration > 8) warnings.push(`scene ${i + 1} (${s.id}) runs ${s.duration}s — long for one beat`);
  if (s.copy.some((c) => c.text.length > 120 && c.kind !== 'lead')) warnings.push(`scene ${i + 1}: display copy over 120 chars will wrap hard`);
}
if (warnings.length) {
  console.log('\nnotes:');
  for (const w of warnings) console.log(`  ! ${w}`);
}
