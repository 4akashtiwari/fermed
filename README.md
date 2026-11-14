# Fermed

**A spec-driven 3D scroll-story renderer.** You write one JSON file; Fermed
renders a scroll-driven 3D website *and* an MP4 of exactly the same film.

Built for an agent studio: a Director agent writes the intent, a worker agent
writes the spec, Fermed does the pixels. Deterministic by construction, so the
preview and the export can never disagree.

```
spec.json ──▶ timeline (pure function of t) ──┬──▶ scroll site  (Lenis + ScrollTrigger)
                                              └──▶ MP4          (Playwright + ffmpeg)
```

---

## Why it exists

Scroll-driven 3D sites are usually hand-built per project: hours of tweening,
and every new page re-invents its own visual language. Fermed moves the craft
into a **closed vocabulary** — shapes, materials, easings, style sets — so that
output is (a) fast to produce, (b) consistent across workers, (c) renderable to
video for social, decks and review.

Three properties it guarantees:

- **One source of truth.** The website and the video read the same timeline.
  A preview at 720p is the same film as the 1080p master.
- **Determinism.** Every value is a pure function of story time. No randomness,
  no frame drift, no "it looked different yesterday".
- **Guardrails over taste.** The schema rejects anything the renderer cannot
  draw; the style linter rejects anything that breaks the house voice.

---

## Quick start

```bash
npm install
npx playwright install chromium      # one-time browser download

npm run dev                          # → http://localhost:5173/?spec=/specs/demo.json
npm run render -- specs/demo.json    # → out/story-zero.mp4
```

First render of `demo.json` (26.5s, 1080p30) takes a few minutes on a laptop CPU.
Nothing needs a GPU — WebGL runs on SwiftShader.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | live scroll site (`?spec=/specs/<slug>.json`, `?mode=render` to scrub) |
| `npm run render -- <spec>` | encode MP4 (see flags below) |
| `npm run validate -- <spec>` | schema check + printed storyboard |
| `npm run lint:style -- <spec>` | taste guardrails, `--strict` for CI |
| `npm run inspect -- <spec>` | camera/fov/veil/visibility at 10 points |
| `npm run new -- "Title" <styleset>` | scaffold a spec from the template |
| `npm run build` | static site into `dist/` |

### Render flags

```bash
node cli/render.mjs specs/demo.json \
  --out out/story-zero.mp4 \
  --size 1920x1080 --fps 30 \
  --crf 18 --preset slow \
  --poster                       # + a poster PNG at the midpoint
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
  "render":   { "width": 1920, "height": 1080, "fps": 30 },
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
  timeline.js    spec → one GSAP timeline; sample(t) → a plain-JSON frame state
  stage.js       three.js scene, environment rig, element registry, render()
  overlay.js     the DOM type layer, framing chrome (letterbox, vignette, grain)
  player.js      scroll mode (Lenis + ScrollTrigger) and drive mode (seek)
  stylesets.js   the six style sets + theme resolution
  geometry.js    closed shape and material vocabulary
  schema.js      zod schema, defaults, storyboard
  easings.js     ease vocabulary + scroll-pacing curves for export

cli/
  render.mjs     Playwright frame capture → ffmpeg
  validate.mjs   schema + storyboard
  lint-style.mjs taste guardrails
  inspect.mjs    what the timeline actually computes
  new.mjs        scaffold from specs/_template.json
```

**Why the video equals the site:** `player.js` has two modes. In `scroll` mode,
Lenis and ScrollTrigger drive `t`. In `drive` mode, `window.__fermed.seek(t)` sets
`t` directly, and `render.mjs` walks it on a fixed fps clock. Both modes call the
same `timeline.sample(t)` → `stage.render()` + `overlay.update()` path.

**Why renders repeat:** no `Math.random`, no `Date.now` in the render path. Idle
motion (spin, float, drift, orbit, pulse) is a closed-form function of absolute
story time, seeded by a hash of the element id.

---

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
