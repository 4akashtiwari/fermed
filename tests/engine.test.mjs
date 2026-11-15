/*
 * Tests for the parts that are pure: the timeline (determinism, scene
 * boundaries), the frame geometry (safe areas, responsive slots) and the layout
 * detector (collision / overflow maths).
 *
 * The browser-dependent checks live in `cli check-layout` and run in CI against
 * real fixtures — that is deliberate: anything that needs a DOM is tested in the
 * real DOM, not a mock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { validateSpec } from '../engine/schema.js';
import { buildTimeline, applyIdle } from '../engine/timeline.js';
import { frameModel, safeArea, slotBox, resolveSlot } from '../engine/frame.js';
import { detectLayoutIssues, intersectArea, contains } from '../engine/framecheck.js';
import { resolveTheme, STYLESET_NAMES } from '../engine/stylesets.js';
import { SHAPE_NAMES, MATERIAL_NAMES, makeGeometry } from '../engine/geometry.js';
import { EASE_SET, EASINGS } from '../engine/easings.js';
import { easeFn, EASE_FNS, Channel, trackValue, makeTrack } from '../engine/tracks.js';
import { aspectSize, ASPECT_PRESETS } from '../engine/aspects.js';

const demo = () => JSON.parse(fs.readFileSync(new URL('../specs/demo.json', import.meta.url), 'utf8'));

// ---------------------------------------------------------------- schema
test('spec schema rejects unknown keys (typos must fail loudly)', () => {
  const raw = demo();
  raw.scenes[0].durration = 5;
  const { ok, errors } = validateSpec(raw);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /durration|unrecognized/i.test(`${e.path} ${e.message}`)));
});

test('spec schema accepts every shipped spec', () => {
  for (const f of ['demo.json', 'example-night-signal.json', '_template.json']) {
    const raw = JSON.parse(fs.readFileSync(new URL(`../specs/${f}`, import.meta.url), 'utf8'));
    const { ok, errors } = validateSpec(raw);
    assert.equal(ok, true, `${f}: ${errors.map((e) => e.path).join(', ')}`);
  }
});

test('render.aspect fills width/height but never overrides explicit size', () => {
  const raw = demo();
  raw.render = { aspect: '9:16' };
  const { spec } = validateSpec(raw);
  assert.deepEqual([spec.render.width, spec.render.height], [1080, 1920]);

  const explicit = demo();
  explicit.render = { aspect: '9:16', width: 800, height: 600 };
  const { spec: s2 } = validateSpec(explicit);
  assert.deepEqual([s2.render.width, s2.render.height], [800, 600]);
});

test('responsive slots validate; a slot map needs at least one entry', () => {
  const raw = demo();
  raw.scenes[0].copy[0].slot = { '16:9': 'center-left', '9:16': 'top-center' };
  assert.equal(validateSpec(raw).ok, true);

  raw.scenes[0].copy[0].slot = {};
  assert.equal(validateSpec(raw).ok, false);
});

// ---------------------------------------------------------------- timeline
test('timeline is deterministic: sampling twice gives identical state', () => {
  const { spec } = validateSpec(demo());
  const tl = buildTimeline(spec);
  const a = JSON.stringify(tl.sample(0.37));
  const b = JSON.stringify(tl.sample(0.37));
  assert.equal(a, b);
});

test('timeline is order-independent: any visit order gives the same frame', () => {
  const { spec } = validateSpec(demo());
  const forward = buildTimeline(spec);
  const backward = buildTimeline(spec);

  const t = 0.62;
  forward.sample(0.1);
  forward.sample(0.9);
  const fromForward = JSON.stringify(forward.sample(t));

  backward.sample(0.95);
  backward.sample(0.05);
  const fromBackward = JSON.stringify(backward.sample(t));

  assert.equal(fromForward, fromBackward);
});

test('sample(0) is not stale — the force-render path applies start values', () => {
  const { spec } = validateSpec(demo());
  const tl = buildTimeline(spec);
  tl.sample(1); // visit the end first
  const start = tl.sample(0);
  const firstSceneCam = tl.scenes[0].cam.from.position;
  assert.deepEqual(
    start.camera.position.map((v) => Number(v.toFixed(4))),
    firstSceneCam.map((v) => Number(v.toFixed(4))),
    'camera at t=0 must be the first scene\'s from-pose',
  );
});

test('scene boundaries are contiguous and cover the whole story', () => {
  const { spec } = validateSpec(demo());
  const tl = buildTimeline(spec);
  assert.equal(tl.scenes[0].start, 0);
  for (let i = 1; i < tl.scenes.length; i++) {
    const prev = tl.scenes[i - 1];
    assert.ok(Math.abs(prev.start + prev.duration - tl.scenes[i].start) < 1e-9);
  }
  const last = tl.scenes[tl.scenes.length - 1];
  assert.ok(Math.abs(last.start + last.duration - tl.total) < 1e-9);
});

test('element identity carries across scenes without redefinition', () => {
  const { spec } = validateSpec(demo());
  const tl = buildTimeline(spec);
  // `core` is defined in scene 1, `hero-knot` only in scene 4. Both exist in
  // the element table from frame 0 — an element defined later is simply not
  // visible yet, which is what keeps mid-film id reuse from popping.
  const early = tl.sample(0.1);
  assert.ok(early.elements.core, 'core defined in scene 1 exists');
  assert.ok(early.elements['hero-knot'], 'hero-knot exists as an entry before its scene');
  assert.equal(early.elements['hero-knot'].opacity, 0, 'but is invisible until its scene enters');
  assert.ok(tl.sample(0.72).elements['hero-knot'].opacity > 0, 'and is visible in its own scene');
});

test('sample() returns plain serialisable data, never live engine state', () => {
  const { spec } = validateSpec(demo());
  const tl = buildTimeline(spec);
  const s1 = tl.sample(0.3);
  assert.doesNotThrow(() => JSON.stringify(s1), 'snapshot must be JSON-serialisable');
  // Mutating a snapshot must not corrupt later samples.
  s1.camera.position[0] = 999;
  s1.elements.core.position[1] = 999;
  assert.notEqual(tl.sample(0.3).camera.position[0], 999);
  assert.notEqual(tl.sample(0.3).elements.core.position[1], 999);
});

test('idle motion is a pure function of time (scrub-safe)', () => {
  const el = { id: 'x', motion: { spin: [0, 0.3, 0], float: { amp: 0.1 } } };
  const st = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], opacity: 1 };
  const a = JSON.stringify(applyIdle(st, el, 4.2, 7));
  const b = JSON.stringify(applyIdle(st, el, 4.2, 7));
  assert.equal(a, b);
  assert.notEqual(JSON.stringify(applyIdle(st, el, 4.3, 7)), a);
});

// ---------------------------------------------------------------- frame
test('safe area respects letterbox and a minimum padding', () => {
  const wide = safeArea(1920, 1080, { letterbox: 0.06 });
  assert.ok(wide.x >= 24);
  assert.ok(wide.y >= 0.06 * 1080);
  assert.ok(wide.h <= 1080 - 0.06 * 1080 * 2);

  const tiny = safeArea(320, 180, { letterbox: 0 });
  assert.ok(tiny.x >= 24, 'padding never collapses below the minimum');
});

test('every slot box stays inside the safe area at every aspect', () => {
  for (const [name, size] of Object.entries(ASPECT_PRESETS)) {
    const model = frameModel(size.width, size.height, { letterbox: 0.06 });
    for (const [slot, def] of Object.entries(model.slots)) {
      const r = def.rect;
      assert.ok(r.x >= model.safe.x - 0.5, `${name}/${slot} left edge`);
      assert.ok(r.y >= model.safe.y - 0.5, `${name}/${slot} top edge`);
      assert.ok(r.x + r.w <= model.safe.x + model.safe.w + 0.5, `${name}/${slot} right edge`);
      assert.ok(r.y + r.h <= model.safe.y + model.safe.h + 0.5, `${name}/${slot} bottom edge`);
    }
  }
});

test('narrow frames give slots the full safe width (vertical art direction)', () => {
  const portrait = frameModel(1080, 1920, { letterbox: 0 });
  const left = portrait.slots['center-left'].rect;
  assert.ok(Math.abs(left.w - portrait.safe.w) < 1, 'portrait slot spans the safe width');
  const landscape = frameModel(1920, 1080, { letterbox: 0 });
  assert.ok(landscape.slots['center-left'].rect.w < landscape.safe.w * 0.8,
    'landscape slot is narrowed to leave room for the subject');
});

test('resolveSlot: nearest aspect wins, distant aspects fall back to default', () => {
  const map = { '16:9': 'center-left', default: 'top-center' };
  assert.equal(resolveSlot(map, 1920 / 1080), 'center-left');
  assert.equal(resolveSlot(map, 1080 / 1920), 'top-center');
  assert.equal(resolveSlot(map, 1), 'top-center');
  assert.equal(resolveSlot('bottom-right', 0.5), 'bottom-right');
  assert.equal(resolveSlot(undefined, 1), 'center-left');
});

// ---------------------------------------------------------------- layout math
test('intersectArea / contains behave at the edges', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 };
  assert.equal(intersectArea(a, { x: 100, y: 0, w: 10, h: 10 }), 0, 'touching is not overlapping');
  assert.equal(intersectArea(a, { x: 50, y: 25, w: 100, h: 100 }), 50 * 25);
  assert.ok(contains({ x: 0, y: 0, w: 100, h: 100 }, a));
  assert.ok(!contains(a, { x: 0, y: 0, w: 200, h: 50 }));
});

test('layout detector finds collisions, clipping and slot overflow', () => {
  const safe = { x: 0, y: 0, w: 1000, h: 600 };
  const frame = { width: 1000, height: 600 };
  const box = { x: 0, y: 0, w: 400, h: 200 };

  const collide = detectLayoutIssues([
    { id: 'a', slot: 'center-left', opacity: 1, box, content: { x: 10, y: 10, w: 300, h: 100 } },
    { id: 'b', slot: 'center-right', opacity: 1, box, content: { x: 40, y: 10, w: 300, h: 100 } },
  ], safe, frame);
  assert.equal(collide.length, 1);
  assert.equal(collide[0].kind, 'collision');
  assert.equal(collide[0].severity, 'error');

  const clip = detectLayoutIssues([
    { id: 'c', slot: 'top-left', opacity: 1, box, content: { x: -40, y: 10, w: 100, h: 40 } },
  ], safe, frame);
  assert.equal(clip[0].kind, 'overflow');
  assert.equal(clip[0].severity, 'error');

  const tall = detectLayoutIssues([
    { id: 'd', slot: 'center', opacity: 1, box: { x: 0, y: 0, w: 400, h: 50 }, content: { x: 0, y: 0, w: 400, h: 120 } },
  ], safe, frame);
  assert.equal(tall[0].kind, 'slot-overflow');
  assert.equal(tall[0].severity, 'warn');
});

test('layout detector ignores invisible copy and hairline touches', () => {
  const safe = { x: 0, y: 0, w: 1000, h: 600 };
  const box = { x: 0, y: 0, w: 400, h: 200 };
  const issues = detectLayoutIssues([
    { id: 'ghost', slot: 'center', opacity: 0, box, content: { x: 0, y: 0, w: 400, h: 100 } },
    { id: 'a', slot: 'center-left', opacity: 1, box, content: { x: 0, y: 0, w: 200, h: 100 } },
    { id: 'b', slot: 'top-left', opacity: 1, box, content: { x: 200, y: 0, w: 200, h: 100 } },
  ], safe);
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------- vocabulary
test('theme resolution: styleset > inline > explicit override', () => {
  const theme = resolveTheme({ styleset: 'chrome-bloom', theme: { palette: { accent: '#ff0000' } } });
  assert.equal(theme.palette.accent, '#ff0000');
  assert.equal(theme.name, 'chrome-bloom');
  const fallback = resolveTheme({ styleset: { name: 'nope' } });
  assert.equal(fallback.name, 'editorial-noir', 'unknown styleset falls back to the house default');
  assert.equal(fallback.fellBack, true, 'and says so, instead of labelling the fallback "nope"');
  assert.equal(resolveTheme({ styleset: 'editorial-noir' }).fellBack, false);
});

test('every styleset defines all five blocks', () => {
  for (const name of STYLESET_NAMES) {
    const t = resolveTheme({ styleset: name });
    for (const key of ['bg', 'surface', 'text', 'muted', 'accent', 'grid']) {
      assert.match(t.palette[key], /^#[0-9a-f]{6}$/i, `${name}.palette.${key}`);
    }
    assert.equal(typeof t.framing.letterbox, 'number');
    assert.equal(typeof t.motion.speed, 'number');
  }
});

test('every shape builds a real geometry', () => {
  for (const shape of SHAPE_NAMES) {
    const geo = makeGeometry(shape, {});
    assert.ok(geo.attributes.position.count > 0, `${shape} produced no vertices`);
    assert.equal(geo.userData.fermedShape, shape);
    geo.dispose();
  }
});

test('shipped specs only use the declared vocabulary', () => {
  const raw = demo();
  for (const scene of raw.scenes) {
    for (const el of scene.elements) {
      assert.ok(SHAPE_NAMES.includes(el.shape), `unknown shape ${el.shape}`);
      assert.ok(MATERIAL_NAMES.includes(el.material || 'solid'), `unknown material ${el.material}`);
      if (el.ease) assert.ok(EASE_SET.has(el.ease), `unknown ease ${el.ease}`);
    }
  }
});

test('aspect presets are internally consistent', () => {
  for (const [name, p] of Object.entries(ASPECT_PRESETS)) {
    const [a, b] = name.split(':').map(Number);
    const actual = p.width / p.height;
    assert.ok(Math.abs(actual - a / b) / (a / b) < 0.01, `${name} is ${actual.toFixed(3)} not ${(a / b).toFixed(3)}`);
    assert.equal(p.width % 2, 0, `${name} width must be even for h264`);
    assert.equal(p.height % 2, 0, `${name} height must be even for h264`);
    assert.deepEqual(aspectSize(name), { width: p.width, height: p.height });
  }
});

// ---------------------------------------------------------------- tracks
test('every advertised ease has a real implementation', () => {
  const missing = EASINGS.filter((name) => !EASE_FNS[name]);
  assert.deepEqual(missing, [], 'engine/easings.js and engine/tracks.js have drifted apart');
});

test('easings are anchored at 0 and 1', () => {
  for (const name of EASINGS) {
    const f = easeFn(name);
    assert.ok(Math.abs(f(0)) < 1e-9, `${name}(0) should be 0, got ${f(0)}`);
    assert.ok(Math.abs(f(1) - 1) < 1e-9, `${name}(1) should be 1, got ${f(1)}`);
  }
});

test('unknown ease names fall back instead of throwing', () => {
  assert.equal(easeFn('not-an-ease')(0.5), easeFn('power2.inOut')(0.5));
});

test('a track is a pure function of t, in any order', () => {
  const track = makeTrack({ key: 'k', from: 0, to: 10, start: 2, duration: 4, ease: 'power2.inOut' });
  const at3 = trackValue(track, 3);
  trackValue(track, 6); trackValue(track, 0); trackValue(track, 5.5);
  assert.equal(trackValue(track, 3), at3);
  assert.equal(trackValue(track, 1), 0, 'before start: holds `from`');
  assert.equal(trackValue(track, 9), 10, 'after end: holds `to`');
  assert.ok(Math.abs(trackValue(track, 4) - 5) < 1e-9, 'midpoint of a symmetric ease is the midpoint');
});

test('a channel with a hold keeps its value through the hold window', () => {
  const c = new Channel('o').from(0)
    .tween(0, 1, 0, 2, 'none')
    .tween(1, 0, 4, 2, 'none');
  assert.equal(c.at(2), 1, 'value after the first tween');
  assert.equal(c.at(3), 1, 'and it holds in the gap between segments');
  assert.equal(c.at(5), 0.5, 'then the second tween drives it');
  assert.equal(c.at(0), 0);
  // order independence
  assert.equal(c.at(3), 1);
});
