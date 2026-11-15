# Fermed

**A spec-driven 3D scroll-story renderer.** You write one JSON file; Fermed
renders a scroll-driven 3D website *and* an MP4 of exactly the same film.

Built for an agent studio: a Director agent writes the intent, a worker agent
writes the spec, Fermed does the pixels. Deterministic by construction, so the
preview and the export can never disagree.

```
spec.json ──▶ tracks (pure function of t) ──┬──▶ scroll site  (Lenis + ScrollTrigger)
                                            └──▶ MP4          (Playwright + ffmpeg)
```

---

## Why it exists

Scroll-driven 3D sites are usually hand-built per project: hours of tweening,
and every new page re-invents its own visual language. Fermed moves the craft
into a **closed vocabulary** — shapes, materials, easings, style sets — so that
output is (a) fast to produce, (b) consistent across workers, (c) renderable to
video for social, decks and review.

Four properties it guarantees:

- **One source of truth.** The website and the video read the same timeline.
  A preview at 720p is the same film as the 1080p master.
- **Determinism.** Every value is a pure function of story time — a keyframed
  channel evaluated from scratch on every seek, never an animation playhead.
  Scrub backwards, render twice, sample out of order: same pixels.
- **Guardrails over taste.** The schema rejects anything the renderer cannot
  draw; the style linter rejects anything that breaks the house voice; the
  layout checker proves type never collides or clips, at every aspect ratio.
- **Any frame shape.** 16:9, 9:16, 1:1, 4:5, 2.39:1, 4:3 — with responsive
  copy slots, so the same spec works as a site hero and as a vertical reel.

---

## Quick start

```bash
npm install
npx playwright install chromium      # one-time browser download
npm run doctor                       # preflight: node, WebGL, ffmpeg, disk, specs

npm run dev                          # → http://localhost:5173/?spec=/specs/demo.json
npm run render -- specs/demo.json    # → out/story-zero.mp4
```

First render of `demo.json` (26.5s, 1080p30) takes a few minutes on a laptop CPU.
Nothing needs a GPU — WebGL runs on SwiftShader.

### Commands

| Command | What it does |
|---|---|
| `npm run doctor` | environment preflight; every failure prints the fix |
| `npm run dev` | live scroll site (`?spec=/specs/<slug>.json`, `?mode=render` to scrub) |
| `npm run render -- <spec>` | encode MP4 (see flags below) |
| `npm run validate -- <spec>` | schema check + printed storyboard |
| `npm run lint:style -- <spec>` | taste guardrails, `--strict` for CI |
| `npm run check:layout -- <spec>` | prove no copy collides/clips, at every aspect |
| `npm run inspect -- <spec>` | camera/fov/veil/visibility at 10 points |
| `npm run new -- "Title" <styleset>` | scaffold a spec from the template |
| `npm test` | unit tests (timeline purity, frame geometry, layout maths) |
| `npm run build` | static site into `dist/` |

The browser commands also answer to `node cli/fermed.mjs <command>`, or
`fermed help` once the package is linked.

### Render flags

```bash
node cli/render.mjs specs/demo.json \
  --out out/story-zero.mp4 \
  --size 1920x1080 --fps 30 \
  --crf 18 --preset slow \
  --poster                       # + a poster PNG (68% through; --poster-at to move it)
  --stills 0.15,0.45,0.8         # PNG stills only, no video
  --from 0.2 --to 0.6            # render a section
  --url http://localhost:5173    # reuse a running dev server
  --keep-frames                  # keep the PNG sequence
  --verbose
```

---

## The spec

```jsonc
{
  "meta":     { "title": "Acme Hero", "slug": "acme-hero", "brief": "…" },
  "styleset": "chrome-bloom",
  "render":   { "aspect": "16:9", "fps": 30 },   // aspect fills width/height
  "scenes": [
    {
      "id": "establish",
      "duration": 5,
      "transition": "cut",
      "camera": {
        "from": { "position": [0, 0.55, 8.4], "lookAt": [0, 0, 0], "fov": 40 },
        "to":   { "position": [0.15, 0.2, 4.6], "lookAt": [0, 0, 0], "fov": 36 },
        "ease": "power2.inOut"
      },
      "elements": [
        {
          "id": "hero",
          "shape": "icosahedron",
          "material": "solid",
          "transform": { "from": { "scale": 0.72 }, "to": { "scale": 1 } },
          "motion": { "spin": [0.02, 0.16, 0], "float": { "amp": 0.06 } },
          "enter": [0, 0.22]
        }
      ],
      "copy": [
        { "kind": "display", "text": "Machined, not assembled.",
          "slot": "center-left", "enter": [0.14, 0.4], "exit": [0.8, 0.94] }
      ]
    }
  ]
}
```

Full field reference: [`skill/fermi-visual-line/references/02-spec-language.md`](skill/fermi-visual-line/references/02-spec-language.md).

Key ideas, in one line each:

- **Everything is scene-relative.** `"enter": [0.2, 0.45]` = 20%→45% through this scene.
- **Elements have identity, not location.** Reuse an `id` across scenes to carry
  the same object forward; the first definition fixes its shape and material.
- **The camera is directed, not animated.** Give a `from` and `to` pose plus an
  ease; never keyframe.
- **Copy is DOM text.** Sharp, selectable, accessible, indexable — not baked into WebGL.

---

## The skill

`skill/fermi-visual-line/` is the working guidebook for the visual-line worker
(agent-readable `SKILL.md` + `references/`, human-readable `HANDBOOK.md`).

```
skill/fermi-visual-line/
├── SKILL.md                     front door: contract, loop, hard rules
├── HANDBOOK.md                  the long version, for humans
└── references/
    ├── 01-role-and-contract.md
    ├── 02-spec-language.md      every field, every default
    ├── 03-story-grammar.md      beats, durations, patterns
    ├── 04-camera-direction.md   shot sizes, moves, transitions
    ├── 05-copy-and-voice.md     word limits, reading-time maths
    ├── 06-stylesets.md          the six house styles
    ├── 07-motion-recipes.md     copy-paste blocks that look good
    ├── 08-render-and-delivery.md
    ├── 09-troubleshooting.md
    └── 10-director-brief-template.md
```

---

## Architecture

```
engine/
  tracks.js      keyframed channels + ease functions — the deterministic core
  timeline.js    spec → channels; sample(t) → a plain-JSON frame state
  frame.js       safe areas, slot boxes, responsive slots (one definition)
  framecheck.js  collision / clipping / overflow detection (pure)
  stage.js       three.js scene, environment rig, element registry, render()
  overlay.js     the DOM type layer, framing chrome, measurement for audit()
  player.js      scroll mode (Lenis + ScrollTrigger) and drive mode (seek)
  aspects.js     16:9, 9:16, 1:1, 4:5, 2.39:1, 4:3 presets
  stylesets.js   the six style sets + theme resolution
  geometry.js    closed shape and material vocabulary
  schema.js      zod schema (strict), defaults, storyboard
  easings.js     ease vocabulary + scroll-pacing curves for export

cli/
  fermed.mjs     one entry point for every command
  doctor.mjs     environment preflight
  render.mjs     Playwright frame capture → ffmpeg
  validate.mjs   schema + storyboard
  lint-style.mjs taste guardrails
  check-layout.mjs  browser-measured layout proof, every aspect
  inspect.mjs    what the timeline actually computes
  new.mjs        scaffold from specs/_template.json
  lib/browser.mjs   shared Chromium + static server (doctor, render, check)
```

**Why the video equals the site:** `player.js` has two modes. In `scroll` mode,
Lenis and ScrollTrigger drive `t`. In `drive` mode, `window.__fermed.seek(t)` sets
`t` directly, and `render.mjs` walks it on a fixed fps clock. Both modes call the
same `timeline.sample(t)` → `stage.render()` + `overlay.update()` path.

**Why renders repeat:** the timeline is a set of keyframed channels evaluated
from scratch on each seek (`engine/tracks.js`) — there is no playhead to drift.
Plus: no `Math.random`, no `Date.now` in the render path, and idle motion (spin,
float, drift, orbit, pulse) is a closed-form function of absolute story time,
seeded by a hash of the element id. `npm test` asserts that any visit order
produces the same frame.

> Fermed used GSAP for the timeline until v0.2. GSAP caches a tween's start value
> the first time the playhead reaches it, so seeking back into a visited region
> could return a neighbouring scene's values — invisible while scrolling
> forward, wrong the moment you scrub or render frame-by-frame. The renderer
> seeks by design, so the timeline is now plain math. GSAP still drives the
> live-site niceties (ScrollTrigger, ticker).

---

## Frame shapes

Set `render.aspect` and the whole pipeline follows: pixel size, safe areas,
letterbox, and (for narrow frames) a vertical art direction where slots take the
full safe width and are separated by band.

| aspect | size | typical use |
|---|---|---|
| `16:9` | 1920×1080 | site hero, YouTube, decks |
| `9:16` | 1080×1920 | reels, stories, shorts |
| `1:1` | 1440×1440 | feed posts |
| `4:5` | 1440×1800 | portrait feed |
| `2.39:1` | 1920×804 | cinemascope, titles |
| `4:3` | 1440×1080 | legacy / projector |

Copy slots can adapt per aspect instead of being fixed:

```jsonc
{ "kind": "metric", "text": "0.35", "suffix": "m",
  "slot": { "16:9": "center-right", "default": "bottom-center" } }
```

Rules are matched to the nearest aspect and fall back to `default`; the layout
checker verifies every slot against every frame you care about.

## Checking layout

```bash
node cli/check-layout.mjs specs/demo.json --aspects 16:9,9:16,1:1
```

Opens the built site in render mode, walks the story, asks the DOM where each
visible copy block actually landed, and tests the boxes pairwise and against the
safe area. Exit 1 on a real collision or clipping, with the fix in the message:

```
story-zero @ 9:16 (608×1080) · 12 story points
1 error(s), 0 warning(s)
  error copy "left" and "right" overlap by 80% of the smaller block (slots: center-left, center-right)
         → different slots that collide in this frame — give one a responsive slot, e.g.
           "slot": {"16:9":"center-left","default":"top-center"}
```

This exists because two of the style linter's rules ("no copy collisions",
"nothing clips the frame edge") depend on rendered type metrics and could only be
eyeballed before. `tests/fixtures/collide-vertical.json` is a spec that must fail
the check; `collide-vertical-fixed.json` is the same spec with the responsive
slot applied. CI asserts both.

## Style sets

| Name | Feel |
|---|---|
| `editorial-noir` | black + warm off-white + amber; print gravity |
| `chrome-bloom` | mirror metal on violet void; tech-couture |
| `bone-archive` | paper white + ink + ochre; museum catalogue |
| `night-signal` | near-black + cyan wireframes; data room |
| `solar-clay` | terracotta + sand, matte; warm and architectural |
| `void-mono` | pure black, white type, no colour; brutalist |

A style set bundles palette, typography, motion feel, geometry language and
framing (letterbox, vignette, grain). Workers pick one per project — consistency
is enforced, not hoped for. Details:
[`references/06-stylesets.md`](skill/fermi-visual-line/references/06-stylesets.md).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `libnspr4.so: cannot open shared object file` | install Chromium's system deps: `sudo apt-get install -y libnspr4 libnss3 libgbm1 libasound2t64 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 libatspi2.0-0` |
| WebGL unavailable in headless | already handled: Chromium launches with `--use-angle=swiftshader --enable-unsafe-swiftshader` |
| `ffmpeg exited 1` | odd frame size — use an even `--size` |
| `npm run doctor` fails on webgl2 | Chromium launched without software GL; reinstall with `npx playwright install --force chromium` |
| render seems to hang after "done" | fixed in v0.2 (Vite dev watchers). Update, or `pkill -f render.mjs` |
| `check:layout` reports a collision you cannot see | it measures the *un-transformed* box, so a mid-entrance translate is not the cause; look at the reported scene and slot |
| vertical output looks cramped | use `render.aspect: "9:16"`, keep one copy slot per scene, and pull the camera back ~25% |
| first frame is black | elements start at `opacityIn: 0`; give the hero `enter: [0, 0.22]` |
| metal renders black | no environment light: raise `render.envIntensity` (default 1.15) |
| type blocks overlapping | more than three copy blocks in one slot |
| export differs from the site | something edited `/engine` — revert |

Full table: [`references/09-troubleshooting.md`](skill/fermi-visual-line/references/09-troubleshooting.md).

---

## Requirements

Node 18+ (tested on 20), Chromium via Playwright, ffmpeg via `ffmpeg-static`
(no system install). No GPU required.

## License

MIT — see [LICENSE](LICENSE).
