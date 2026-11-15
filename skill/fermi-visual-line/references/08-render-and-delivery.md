# 08 — Render, naming, and delivery

Everything about turning a spec into files you hand over — plus the DELIVERY.md
that goes with them.

---

## 1. The commands

Run from the repo root.

```bash
fermed doctor                                     # environment preflight (once per machine)
fermed validate specs/<slug>.json                 # schema + storyboard, exit 0/1
fermed lint-style specs/<slug>.json               # taste guardrails (--strict to gate CI)
fermed check-layout specs/<slug>.json --aspects 16:9,9:16   # measured DOM layout proof
fermed inspect specs/<slug>.json                  # camera/fov/veil/visibility at 10 points
fermed render specs/<slug>.json --stills 0.15,0.45,0.8 --size 1280x720
fermed render specs/<slug>.json --out out/<slug>.mp4
npm run dev                                       # live site at http://localhost:5173/?spec=/specs/<slug>.json
```

`fermed <command>` and `node cli/<command>.mjs` are the same thing; use whichever
your environment has. `fermed help` lists every command.

### `render` flags

| Flag | Effect |
|---|---|
| `--out <path>` | output file, default `out/<slug>.mp4` |
| `--size 1920x1080` | overrides `render.width/height` |
| `--fps 30` | overrides `render.fps` |
| `--stills a,b,c` | write PNG stills at those story progress points, no video |
| `--poster` | also write a poster PNG (68% through the film) |
| `--poster-at 0.8` | move the poster frame |
| `--from 0.2 --to 0.6` | render a section only — for testing a scene |
| `--crf 18` | quality; 16 master, 18 deliverable, 22 draft |
| `--preset medium` | faster encode, slightly larger file |
| `--keep-frames` | keep the PNG sequence (for a manual encode or a review) |
| `--url http://…` | render from an already-running dev server (faster iteration) |
| `--verbose` | per-frame timings and the WebGL renderer string |

### Time and cost

| Job | Laptop CPU (2 cores) | Normal machine |
|---|---|---|
| 3 stills at 720p | 8s | 4s |
| 25s film at 1080p/30 | 6–9 min | 2–4 min |
| 25s film at 720p/24 | 3–4 min | 1.5 min |
| 25s film at 1080p/30, `--preset medium` | 4–6 min | 1.5–2.5 min |

Iterate at 720p. Render the master once, at the end.

## 2. The prescribed pipeline

```bash
# 1. parse check
node cli/validate.mjs specs/acme-hero.json

# 2. taste check
node cli/lint-style.mjs specs/acme-hero.json

# 3. LOOK AT IT  (do not skip)
node cli/render.mjs specs/acme-hero.json --stills 0.15,0.45,0.8 --size 1280x720
#    open the 3 PNGs. Check: copy collisions? subject visible? any black frame?
#    anything on the 3-strike list in §4 → fix the spec, re-run step 3. (8 seconds per pass.)

# 4. draft film at 720p to check motion, not pixels
node cli/render.mjs specs/acme-hero.json --size 1280x720 --fps 24 --preset medium --out out/acme-hero-draft.mp4

# 5. master
node cli/render.mjs specs/acme-hero.json --out out/acme-hero.mp4 --poster
```

Steps 3 and 4 exist because motion defects are invisible in stills and still
defects are invisible in motion. You need both.

## 3. Naming

| Artefact | Convention | Example |
|---|---|---|
| spec | `specs/<slug>.json` | `specs/acme-hero.json` |
| film | `out/<slug>.mp4` | `out/acme-hero.mp4` |
| poster | `out/<slug>-poster.png` | `out/acme-hero-poster.png` |
| stills for review | `out/<slug>-still-NN.png` | `out/acme-hero-still-02.png` |
| draft | `out/<slug>-draft.mp4` | `out/acme-hero-draft.mp4` |

`<slug>` is lowercase, hyphenated, ≤40 chars, and matches `meta.slug`. Never
`final`, `v2`, `FINAL-final`, or a date — Git history is the version system.

## 4. Review gate before you ship

Look at the three stills and the draft, and check this list. Any single failure
means you go back to step 3, not into the encode.

1. Frame 0 is not blank or mid-fade
2. Last frame is a held composition, not a cut to black
3. No copy block overlaps another
4. No copy block sits on top of the subject
5. Every display line is fully readable (no clipping at the frame edge)
6. The hero object is visible in at least 60% of scenes
7. No scene is visually identical to its neighbour
8. No frame is fully black except an intentional dip
9. Motion does not stop dead mid-scene
10. The film still says the takeaway if you mute it

## 4b. Delivering two frame shapes

If the brief wants a site hero **and** a vertical cut, do not write two specs.
Set the responsive slots once and render twice:

```bash
node cli/check-layout.mjs specs/<slug>.json --aspects 16:9,9:16   # prove both
node cli/render.mjs specs/<slug>.json --aspect 16:9 --out out/<slug>-wide.mp4
node cli/render.mjs specs/<slug>.json --aspect 9:16 --out out/<slug>-vertical.mp4
```

(`--aspect` overrides `render.aspect` at render time.) Notes for vertical:

- one copy slot per scene, usually `top-center` or `bottom-center`
- pull the camera back ~25% in `z` — a vertical frame crops the sides, not the
  middle
- shorten leads to ~12 words; portrait lines wrap sooner
- keep the letterbox at ≤4% or you lose a third of the frame

## 5. DELIVERY.md

Write this at the repo root (overwrite each job — the spec is the archive, this
file is the note). Twelve lines, no more.

```markdown
# Delivery — <Project title>

**Spec** `specs/<slug>.json` · **Styleset** `editorial-noir`
**Files** `out/<slug>.mp4` (26.5s, 1920×1080, 30fps, h264 crf18) · `out/<slug>-poster.png`
**Reads as** _One sentence: what a stranger would say this film is about._
**Beats** 1 establish 5.0s · 2 orbit 5.5s · 3 descend 5.0s · 4 reveal 5.0s · 5 resolve 6.0s
**Director's brief** _link or one-line quote_
**Changed** _anything you decided that the brief left open — styleset choice, headline wording, dropped element_
**Risk** _the weakest beat, why, and the two things you would try next_
**Re-render** `node cli/render.mjs specs/<slug>.json --out out/<slug>.mp4`
**Versions** Fermed 0.1.0 · Node 20 · Chromium <version from --verbose>
**Render time** 6.2 min at 1080p/30 on 2 cores
**Not done** _anything deliberately out of scope, so nobody assumes it exists_
```

The `Risk` line is mandatory and must be specific. "Could be better" is not a
risk. "Beat 3's dip is 1.2s and steals emphasis from the resolve; try a cut, or
shorten descend to 4.2s" is a risk.

## 6. Determinism — the thing you check once and then trust

The film is generated by seeking a timeline to exact times, so it is
reproducible. Verify once per job:

```bash
node cli/render.mjs specs/<slug>.json --stills 0.45 --size 1280x720 --out out/_a.png
node cli/render.mjs specs/<slug>.json --stills 0.45 --size 1280x720 --out out/_b.png
# the two PNGs should be byte-identical or visually identical
```

If they differ: something non-deterministic got in (a `Math.random`, a
`Date.now`, a CSS animation that was not in the render path, a font that loaded
late). Report it as a framework bug — do not paper over it.

## 7. Delivering to Motion and Engineering

**To Motion** (sound + edit):

```
film:        out/<slug>.mp4  (silent, frame-locked, 30fps)
length:      exactly N seconds, no trailing black
scene map:   t=0.00 establish · 5.00 orbit · 10.50 descend · 15.50 reveal · 20.50 resolve · 26.50 end
poster:      out/<slug>-poster.png (frame at t=18.55)
notes:       the dip at 10.5s is a natural sound-break; the resolve wants the quietest mix
```

Give them the **seconds**, not the fractions. Fractions are for the spec.

**To Engineering** (site embed):

```
spec:        specs/<slug>.json
command:     node cli/render.mjs or npm run dev/?spec=/specs/<slug>.json
scroll feel: pxPerSecond 170 (≈4500px of page for 26.5s)
notes:       hero copy is DOM text — accessible, selectable, indexable.
             Respects prefers-reduced-motion (pins off, simple fades remain).
```

## 8. Handing back a revision

When the Director asks for changes, change the *smallest* thing that answers the
note, and say what you changed.

| Note | Change |
|---|---|
| "the second beat drags" | shorten that scene's `duration`; do not touch its camera |
| "the ending feels abrupt" | raise `export.outroHold`, and make the resolve camera end slower (`power2.out`) |
| "there's a lot of text" | cut words, not scenes |
| "it doesn't feel premium" | styleset change, or roughness down + envIntensity up |
| "I want it to feel faster" | lower scene durations together, or raise `scroll.pxPerSecond` (the site, not the film) |
| "the sphere is boring" | change shape to `icosahedron detail 1` or `torusKnot` |

Re-render once. If the note is about story rather than execution, it goes back to
the Director, not into the spec.

## 9. Files you must never touch

`engine/`, `cli/`, `src/`, `index.html`, `vite.config.js`, `package.json`.

You may touch: `specs/`, `out/`, `DELIVERY.md`, and — only with a stated reason
in DELIVERY.md — `engine/stylesets.js` (new styleset) and `skill/reference/`
(a genuinely new recipe).

If the framework blocks the brief, write it in DELIVERY.md under `Not done` and
tell the Director. That is a framework gap, and it is valuable information.
