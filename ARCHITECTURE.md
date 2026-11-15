# Fermed — architecture

Why the code is shaped the way it is. Read this before changing anything in
`/engine`; it explains the invariants that make the video match the site.

---

## 1. The one idea

> Every pixel is a pure function of story time `t`.

There is no animation state that accumulates across frames, no `requestAnimationFrame`
delta that feeds back into the scene, no random seed that changes per run. Given
`t`, the whole frame — camera, every element's transform and opacity, every word
of type — is determined.

Everything else follows from that:

- the website and the MP4 cannot drift apart, because both call the same
  `sample(t)`
- a render is reproducible, so a bug is reproducible
- scrubbing backwards looks exactly like scrubbing forwards
- an editor can note "the dip at 10.5s" and know it will be there tomorrow

## 2. Layer map

```
                    specs/<slug>.json
                            │
                  engine/schema.js  (zod, .strict())
                            │
                  engine/timeline.js  ── gsap ──▶  one paused timeline
                            │                       sample(t) → plain JSON
                            │
             ┌──────────────┴───────────────┐
             ▼                              ▼
    engine/stage.js                 engine/overlay.js
    three.js: geometry,             DOM: type, letterbox,
    materials, env, camera          vignette, grain, veil
             │                              │
             └──────────────┬───────────────┘
                            ▼
                    engine/player.js
                    ├── scroll mode: lenis + ScrollTrigger → t
                    └── drive  mode: window.__fermed.seek(t) ← cli/render.mjs
```

### `tracks.js` — the single source of truth

The timeline is a set of **channels**, each one a list of keyframes evaluated as
a pure function of time. `sample(t)` computes every value from scratch — there is
no playhead, no cached start value, no ordering. That is what makes scrubbing,
frame-by-frame rendering and repeated renders identical by construction.

```js
const c = new Channel('camera.position.0').from(0)
  .tween(0, 0.55, 0, 5, 'power2.inOut')     // from, to, start, duration, ease
  .tween(0.55, 0.2, 5, 5.5, 'sine.inOut');
c.at(7.2); // always the same number
```

Ease **names** stay in the GSAP vocabulary (`power2.inOut`, `expo.out`, …) and
are implemented in `tracks.js`, so specs did not change when the engine did.

> **Why not GSAP for the timeline?** It was, until v0.2, and it was wrong for
> this job. GSAP inits a tween when the playhead first reaches it and caches the
> start value at that moment; crossing back into an initialised tween can
> re-apply its `from` and overwrite the previous segment's end. Forward-only
> playback never sees it. A renderer that seeks by definition does. Two
> consecutive renders of the same frame could disagree. That is unacceptable in a
> product whose pitch is determinism, so the timeline became math. GSAP still
> powers the live site (ScrollTrigger, ticker); it no longer owns any value that
> reaches a frame.

`sample(t)` returns a **plain-JSON snapshot**:

```js
{ t, tSec, t01, bg, veil, camera:{position,lookAt,fov},
  elements: { id: {position,rotation,scale,opacity} },
  copies:   { id: {opacity,y,words[]} },
  sceneIndex, sceneProgress }
```

Implementation rules that are load-bearing:

1. **Every animated number is a channel.** No animation library owns a value that
   reaches a frame. If you add motion, add a channel.
2. **Snapshots are deep-copied.** Consumers must not be able to reach into engine
   state, and snapshots must be JSON-serialisable (tests assert both).
3. **One definition of layout.** `frame.js` decides where type may live; the
   overlay obeys it and `framecheck.js` verifies the result. Nothing else
   computes a slot position by hand.

### `stage.js` — the 3D side

Owns the renderer, camera, lights, environment and the element registry.
Elements are created **once** from the union of all scenes (an id defined in any
scene exists from the start); each frame only writes transforms and visibility.
That is why an element can be "carried" between scenes without popping.

The environment is generated procedurally from the theme palette (a box of
emissive panels, run through `PMREMGenerator`). Without it, `metalness > 0`
renders black — there is nothing to reflect. This was the first bug the demo
exposed.

### `frame.js` + `framecheck.js` — layout is a proof, not a judgement

`frame.js` is the only place that decides where type may live: safe area (frame
minus padding minus letterbox), slot boxes, and responsive slot resolution
(`{"16:9": "center-left", "default": "top-center"}`). Narrow frames get a
different art direction (full-width slots separated by band) because that is how
vertical video actually works.

`framecheck.js` is pure geometry: pairwise collision, safe-area containment and
slot overflow, each with a severity and a suggested fix. `overlay.audit()` feeds
it real measured boxes (with entrance transforms neutralised), and
`cli/check-layout.mjs` walks a story at N points across M aspects in a real
browser. CI asserts that a deliberately broken fixture fails and its fixed twin
passes — so the guard itself is tested.

### `overlay.js` — the type side

Type is DOM, not textures: sharp at any resolution, selectable, accessible,
indexable, and free to the GPU. Copy blocks are grouped by `(scene, slot)` so a
scene can stack an eyebrow, headline and lead in one corner as a column instead
of three absolute layers fighting for the same pixels.

Framing chrome lives here too — letterbox, vignette, grain, veil. In
`mode=render` the interactive chrome (progress bar, HUD, chapters, grain) is
hidden via `body[data-mode="render"]`.

### `player.js` — the two modes, one path

```js
function seek(t) {
  const sample = timeline.sample(t);
  stage.render({ ...sample, __sceneMeta });
  overlay.update(sample);
}
```

- **scroll mode**: Lenis smooths the wheel, ScrollTrigger reports page progress,
  `seek(progress)` runs on `gsap.ticker`.
- **drive mode**: `mode=render` in the URL or `navigator.webdriver`. The player
  skips all scroll wiring, hides the chrome, exposes `window.__fermed.seek`, and
  renders a single still.

`cli/render.mjs` is nothing more than a loop around drive mode:

```
for frame in 0..N:
  t = scrollEase(frame / N)
  page.evaluate(t => window.__fermed.seek(t), t)
  page.screenshot() → PNG
ffmpeg(-framerate fps -i f%05d.png) → h264
```

## 3. Determinism rules for contributors

- No `Math.random()` in `engine/`. Idle motion uses `hash01()` seeded by the
  element id.
- No `Date.now()` / `performance.now()` inside `sample()`, `render()` or
  `update()`.
- Any new idle motion must be a closed-form function of `tSec`.
- Fonts must be loaded before frame 0. `render.mjs` awaits `document.fonts.ready`
  and then waits a paint; if you add a web font, keep that contract.
- CSS animations are allowed only on the overlay chrome, never on copy that
  appears in the film.

## 4. Why these libraries

| Choice | Reason |
|---|---|
| **GSAP** | one timeline primitive, `seek`/`render` semantics that make scrubbing exact; free for commercial use since 2025 |
| **Three.js** | the smallest API that covers geometry, PBR materials, PMREM; no framework tax |
| **Lenis** | ~3 KB, designed to feed ScrollTrigger, and its reduced-motion handling is honest |
| **Vite** | dev server + static build, zero config for this shape of project |
| **Playwright** | deterministic headless Chromium with WebGL via SwiftShader, and `screenshot()` that composites canvas + DOM correctly |
| **ffmpeg-static** | no system install; h264 with `+faststart` |
| **zod** | the spec is a contract, and it should fail with a precise sentence |

Deliberately absent: React (the UI is 5 DOM nodes), a physics engine (idle motion
is authored, not simulated), a loader for external models (the vocabulary is
closed on purpose — reproducibility over expressiveness).

## 5. Extension points

| Want to… | Do this | Cost |
|---|---|---|
| add a style set | `engine/stylesets.js` | trivial, no schema change |
| add a shape | `SHAPES` in `engine/geometry.js` | one function |
| add a material | `MATERIALS` in `engine/geometry.js` | one function |
| add an ease | `engine/easings.js` (it is also the validator list) | one string |
| add an idle motion | `applyIdle` in `engine/timeline.js` + schema | must be a function of `tSec` |
| add a copy slot | `frame.js` slot tables + schema enum | trivial, then run `check-layout` |
| add an aspect | `engine/aspects.js` | one entry; check narrow-frame behaviour |
| support vertical video | set `render` to 1080×1920; copy slots already adapt | test the letterbox |
| add audio to the site | `player.js`: a muted `<audio>` unlocked on first scroll | small |

Not planned, by design: external model loading, video textures, real-time
audio-reactive visuals, per-element custom shaders. Each one breaks the closed
vocabulary, and the closed vocabulary is the product.

## 6. Known limitations

- **No text wrapping control.** Long display lines wrap by browser default; the
  linter's word limits are the real guard.
- **`text3d` is an extruded slab**, not real type geometry, and no font pipeline
  exists.
- **Fonts are system stacks + theme names.** A webfont can be dropped in
  `public/fonts` and referenced from a style set, but nothing does it by default.
- **SwiftShader is CPU rendering.** Long films at 4K on a laptop are slow; use
  720p drafts.
- **One scene can be in only one place at a time**, so an element cannot be in
  two scenes simultaneously with different poses — the last scene wins.
- **`glass` transmission is expensive** with many instances; keep it to 1–2
  elements.
- **Type metrics differ per platform.** The layout checker runs in the same
  Chromium that renders the film, so the check matches the export; a different
  browser on the client's machine may wrap differently.
- **Ease implementations are ours.** They match the GSAP names closely but are
  not bit-identical to GSAP's curves. Specs are unaffected; a frame-by-frame diff
  against an older GSAP render would show sub-pixel differences.
