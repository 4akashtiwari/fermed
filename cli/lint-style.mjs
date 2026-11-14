#!/usr/bin/env node
/*
 * fermed lint-style — the taste guardrails.
 *
 * The schema stops a spec from breaking the renderer. This stops a spec from
 * looking like it was made by six different people. Every rule here exists
 * because it was a real visual defect, not because it is neat.
 *
 *   node cli/lint-style.mjs <spec.json> [--strict]
 *
 * Exit 1 on errors, exit 0 with warnings unless --strict.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { validateSpec } from '../engine/schema.js';
import { resolveTheme } from '../engine/stylesets.js';

const file = process.argv[2];
const strict = process.argv.includes('--strict');
if (!file) {
  console.error('usage: node cli/lint-style.mjs <spec.json> [--strict]');
  process.exit(1);
}

const errors = [];
const warns = [];
const err = (scene, msg) => errors.push({ scene, msg });
const warn = (scene, msg) => warns.push({ scene, msg });

const raw = JSON.parse(await fs.readFile(path.resolve(process.cwd(), file), 'utf8'));
const { ok, spec, errors: schemaErrors } = validateSpec(raw);
if (!ok) {
  for (const e of schemaErrors) errors.push({ scene: 'schema', msg: `${e.path}: ${e.message}` });
  report();
  process.exit(1);
}

const theme = resolveTheme(spec);
const total = spec.scenes.reduce((n, s) => n + s.duration, 0);

// ---------------------------------------------------------------- structure
if (spec.scenes.length < 3) warn('story', `only ${spec.scenes.length} scenes — a story needs at least 3 beats (establish / develop / resolve)`);
if (spec.scenes.length > 7) warn('story', `${spec.scenes.length} scenes is a lot for one short — consider splitting into two specs`);
if (total < 12) warn('story', `total ${total}s is short; under 12s rarely carries an idea`);
if (total > 75) warn('story', `total ${total}s is long for a scroll story; 20–50s is the sweet spot`);

// every scene needs the three load-bearing parts
spec.scenes.forEach((s, i) => {
  const id = s.id || `scene-${i}`;
  if (!s.copy?.length) err(id, 'no copy — every beat needs at least one line of type');
  if (!s.camera) warn(id, 'no camera block — it will inherit the previous scene end pose; give it a move');
  if (s.duration < 3) warn(id, `${s.duration}s is too quick to read anything`);
  if (s.duration > 8) warn(id, `${s.duration}s is long for one beat; consider splitting`);
  if ((s.elements || []).length > 8) warn(id, `${s.elements.length} elements — over 8 the frame turns to noise`);
  if ((s.elements || []).length === 0) warn(id, 'no elements — the scene is type over an empty stage');
});

// ---------------------------------------------------------------- camera flow
for (let i = 1; i < spec.scenes.length; i++) {
  const prev = spec.scenes[i - 1];
  const cur = spec.scenes[i];
  const prevTo = prev.camera?.to?.position || prev.camera?.position;
  const curFrom = cur.camera?.from?.position || cur.camera?.position;
  if (!prevTo || !curFrom) continue;
  const jump = Math.hypot(...prevTo.map((v, k) => v - curFrom[k]));
  const tr = cur.transition || 'fade';
  if (tr === 'cut' && jump > 0.6) {
    err(cur.id, `hard cut with a ${jump.toFixed(2)} unit camera jump — a cut implies continuity, not teleportation`);
  } else if (tr === 'fade' && jump > 1.4) {
    err(cur.id, `${jump.toFixed(2)} unit camera jump under a short fade; use transition "dip" for travel that large`);
  }
  const fovA = prev.camera?.to?.fov ?? prev.camera?.fov;
  const fovB = cur.camera?.from?.fov ?? cur.camera?.fov;
  if (fovA != null && fovB != null && Math.abs(fovA - fovB) > 18) {
    warn(cur.id, `fov snaps ${fovA}→${fovB}; that reads as a zoom glitch unless it is a cut`);
  }
}

// ---------------------------------------------------------------- copy rules
const SLOT_CAP = 3;
spec.scenes.forEach((s, i) => {
  const id = s.id || `scene-${i}`;
  const slotCount = {};
  (s.copy || []).forEach((c) => {
    const text = String(c.text || '');
    const words = text.split(/\s+/).filter(Boolean);
    slotCount[c.slot] = (slotCount[c.slot] || 0) + 1;

    if (c.kind === 'display' && words.length > 9) err(id, `display copy "${text.slice(0, 32)}…" is ${words.length} words — 9 max, it will wrap into a wall`);
    if (c.kind === 'lead' && words.length > 34) warn(id, `lead copy is ${words.length} words — trim to under 34`);
    if (c.kind === 'metric' && !/^[\d.,:%+\-−]+$/.test(text.trim())) err(id, `metric "${text}" must be a number (suffix goes in "suffix")`);
    if (text.includes('!')) err(id, `exclamation mark in "${text.slice(0, 24)}…" — this voice does not shout`);
    if (text === text.toUpperCase() && text.length > 34) warn(id, 'long all-caps line — reserve caps for eyebrows under 34 characters');
    if (/\.\.\./.test(text)) warn(id, 'ellipsis — cut the line instead of trailing off');
    if (c.enter && c.exit && c.exit[0] < c.enter[1]) err(id, `copy "${c.id || text.slice(0, 16)}" exits before it finishes entering`);

    // readability budget: a viewer gets roughly the scene duration minus exits
    const visible = ((c.exit?.[0] ?? 0.96) - (c.enter?.[0] ?? 0.1)) * s.duration;
    const needed = words.length / 3.6 + 0.5; // ~3.6 words per second of display type, plus a beat
    if (visible < needed) warn(id, `"${text.slice(0, 24)}…" is on screen ${visible.toFixed(1)}s but needs ~${needed.toFixed(1)}s to read`);
  });

  for (const [slot, n] of Object.entries(slotCount)) {
    if (n > SLOT_CAP) err(id, `${n} copy blocks in slot "${slot}" — ${SLOT_CAP} max or they stack into a mess`);
  }
});

// ---------------------------------------------------------------- style lock
const ALLOWED_MATERIALS = new Set(['solid', 'accent', 'glass', 'wire', 'ghost', 'topographic']);
spec.scenes.forEach((s, i) => {
  const id = s.id || `scene-${i}`;
  const kinds = new Set();
  (s.elements || []).forEach((el) => {
    kinds.add(el.material || 'solid');
    if (!ALLOWED_MATERIALS.has(el.material || 'solid')) err(id, `material "${el.material}" is not in the style set vocabulary`);
    const col = el.materialOptions?.color;
    // Hard-coded colours are how style drift starts: the theme should own colour.
    if (col && !Object.values(theme.palette).includes(col)) {
      warn(id, `element "${el.id}" hard-codes colour ${col}; use a palette role or an accent material instead`);
    }
    const fov = el.shape === 'plane' || el.shape === 'grid' ? null : null;
    if (fov === undefined) return;
  });
  if (kinds.size > 5) warn(id, `${kinds.size} materials in one scene — pick 2–3 that belong together and let the rest be one material`);
});

// ---------------------------------------------------------------- render math
const px = Math.round(total * spec.scroll.pxPerSecond);
if (px < 2400) warn('scroll', `page scrolls ${px}px total; under 2400px the site feels twitchy`);
if (px > 14000) warn('scroll', `page scrolls ${px}px total; over 14000px it feels endless on a trackpad`);
if (spec.render.fps !== 30 && spec.render.fps !== 24) warn('render', `fps ${spec.render.fps} — 24 (cinema) or 30 (web) are the house standards`);
if (!spec.meta.brief) err('meta', 'meta.brief is empty — the director’s intent must be recorded with the spec');

report();

function report() {
  const label = path.basename(file);
  if (errors.length) {
    console.error(`✗ ${label} — ${errors.length} error(s), ${warns.length} warning(s)\n`);
    for (const e of errors) console.error(`  error  [${e.scene}] ${e.msg}`);
    for (const w of warns) console.error(`  warn   [${w.scene}] ${w.msg}`);
    process.exit(1);
  }
  if (warns.length) {
    console.log(`${strict ? '✗' : '✓'} ${label} — 0 errors, ${warns.length} warning(s)\n`);
    for (const w of warns) console.log(`  warn   [${w.scene}] ${w.msg}`);
    if (strict) process.exit(1);
    console.log('\n  warnings only — this spec will render, but read the notes above.');
    return;
  }
  console.log(`✓ ${label} — clean. Style holds, copy fits, camera flows.`);
}
