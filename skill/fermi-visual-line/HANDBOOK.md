# The Fermi Handbook

**Visual line · Fermed · v0.1**

This is the human-readable version of the skill. An agent should read `SKILL.md`
and load `references/` on demand. A person — a new hire, a freelancer, a
reviewer — should read this file start to finish once, then keep `SKILL.md` open
while working.

---

## Contents

1. [What this job is](#1-what-this-job-is)
2. [What Fermed actually is](#2-what-fermed-actually-is)
3. [How a job arrives and leaves](#3-how-a-job-arrives-and-leaves)
4. [The spec, explained like a person](#4-the-spec-explained-like-a-person)
5. [A worked example, start to finish](#5-a-worked-example-start-to-finish)
6. [The craft rules](#6-the-craft-rules)
7. [Your first week](#7-your-first-week)
8. [Glossary](#8-glossary)
9. [Quality bar and review](#9-quality-bar-and-review)
10. [Ground rules and escalation](#10-ground-rules-and-escalation)

---

## 1. What this job is

You make **short 3D scroll-stories**: 20–40 second films that play as you scroll
a website, and that also exist as an MP4.

You are not a 3D artist, a front-end developer, or a motion designer. You are a
**director of a very small film** who works by writing a single JSON file. The
software does the rendering.

Three things are yours and nobody else's:

- **The story's shape** — how many beats, how long, in what order (within the
  Director's story).
- **The camera** — every position, every move, every ease.
- **The words on screen** — every headline, its length, when it appears, where it
  sits.

Three things are not yours: the engineering of the renderer, the sound, and the
client's claims. Stay in your lane and the job is calm.

Why this role exists: a well-directed 25-second 3D story costs a studio a week
and a 3D artist's schedule. With Fermed it costs an hour, because the
craft knowledge has been moved out of the artist's hands and into a spec
language with guardrails. Your value is the **judgement** about which 25 seconds,
not the ability to model a torus knot.

---

## 2. What Fermed actually is

```
 specs/<slug>.json        ← you write this
        │
        ▼
   ┌──────────────┐
   │  timeline.js │  builds one GSAP timeline from the spec
   └──────┬───────┘  the whole film is a pure function of story time t (0..1)
          │
    ┌─────┴──────┐
    ▼            ▼
 stage.js     overlay.js     three.js draws geometry · DOM draws type
    │            │
    └─────┬──────┘
          ▼
     player.js — two modes:
          • scroll : Lenis + ScrollTrigger drive t  → the website
          • drive  : seek(t) is called directly     → the MP4
          ▼
      cli/render.mjs — Playwright walks t on a frame clock, ffmpeg encodes
```

Four consequences you should internalise:

1. **The film and the site are the same film.** Both read the same timeline.
   That is why you can preview at 720p and trust the 1080p export.
2. **Everything is deterministic.** Time is the only input. No random numbers, no
   "it depends on the machine". Render twice, get the same film.
3. **The vocabulary is closed.** Shapes, materials, easings and stylesets are
   fixed lists. You cannot draw arbitrary things — which is what keeps output
   consistent across workers.
4. **Type is DOM, not WebGL.** Text stays sharp, selectable and accessible. It
   never gets baked into a texture.

---

## 3. How a job arrives and leaves

```
DIRECTOR ──brief+beats──▶ YOU ──spec──▶ FERMED ──site + mp4──▶ MOTION / ENGINEERING
```

### The brief must contain

audience · takeaway · feeling · subject · forbidden claims · 3–6 beats ·
duration band · deliverable list. See `references/10`.

### You return

```
specs/<slug>.json       the source of truth
out/<slug>.mp4          1080p h264
out/<slug>-poster.png   one still
DELIVERY.md             12 lines: what it is, what's risky, how to re-render
```

### Timeline of a typical job

| Step | Time | Output |
|---|---|---|
| read brief, fill gaps | 5 min | confirmed brief |
| storyboard as a table | 10 min | 5–7 rows of prose |
| author the spec | 25–40 min | `specs/<slug>.json` |
| validate + lint + 3 stills | 5 min | fixes |
| draft 720p | 4 min | `-draft.mp4` |
| master 1080p | 6 min | `out/<slug>.mp4` |
| DELIVERY.md | 5 min | handed over |

About **90 minutes** for a good 25-second film, of which 10 is rendering. If a job
takes four hours, the storyboard step was skipped.

---

## 4. The spec, explained like a person

A spec is a **film described as data**: a list of scenes, each with a camera, a
cast of objects, and some words.

```jsonc
{
  "meta": { "title": "Acme Hero", "slug": "acme-hero", "brief": "…" },
  "styleset": "chrome-bloom",
  "scenes": [
    { "id": "establish", "duration": 5, "camera": {…}, "elements": […], "copy": […] },
    { "id": "orbit",     "duration": 5, … },
    …
  ]
}
```

### Three ideas that make the rest make sense

**1. Everything is scene-relative.** `"enter": [0.2, 0.45]` means "start entering
20% into this scene, finish 45% of the way in". So retiming a scene is one
number: change `duration`.

**2. Elements have identity, not location.** An element with `"id": "hero"` is
the *same object* in every scene that mentions it. Scene 1 defines its shape and
material; scenes 2–5 re-pose it. This is how a camera move keeps a subject
continuous.

**3. The camera is directed, not animated.** You give a `from` pose and a `to`
pose (position, look-at, fov) and an ease. The framework interpolates. You never
keyframe.

### The nine copy slots

Think of the frame as a tic-tac-toe grid. Put the subject on one side, the type on
the other. Three items in one slot stack as a column (eyebrow → headline → lead).

---

## 5. A worked example, start to finish

**The brief** (abridged): a premium hardware client wants a 25s homepage hero.
Audience: design-literate buyers. Takeaway: "this thing is machined, not
assembled." Feeling: precise, expensive, quiet. Beats: (1) it exists, (2) look
at how it's built, (3) the material, (4) it belongs to you.

### Step 1 — storyboard as prose (10 minutes)

```
#  SCENE      DUR   IDEA (≤6 words)             MOVE              COPY                TRANS
1  establish  5.0   the object already exists    push 8.4→4.6      premise             cut
2  orbit      5.5   it is machined, not built    arc 3.9→-3.4      one claim           fade
3  descend    5.0   the tolerance is the point   dolly 3.2→0.35    metric: 0.02mm      dip
4  reveal     5.0   this is the material         drift macro       claim               fade
5  resolve    6.0   it is yours                  pull out + rise   takeaway            fade
```

Note there is **one metric** in the whole film, in the beat that is about
precision. That is not an accident.

### Step 2 — pick the style set

Precise + expensive + quiet + hardware → `chrome-bloom`. One styleset, whole
film, done.

### Step 3 — author, scene by scene

```bash
node cli/new.mjs "Acme Hero" chrome-bloom
```

Then replace the template's scenes, one at a time. Scene 1:

```jsonc
{
  "id": "establish",
  "label": "It exists",
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
      "geometry": { "r": 1.05, "detail": 1 },
      "material": "solid",
      "materialOptions": { "metalness": 0.9, "roughness": 0.16 },
      "transform": { "from": { "scale": 0.72 }, "to": { "scale": 1, "rotation": [0.3, 1.1, 0.1] } },
      "motion": { "spin": [0.02, 0.16, 0], "float": { "amp": 0.06, "speed": 0.8 } },
      "opacityIn": 0,
      "enter": [0, 0.22]
    }
  ],
  "copy": [
    { "kind": "eyebrow", "text": "ACME / MACHINED", "slot": "center-left", "enter": [0.05, 0.18], "exit": [0.5, 0.6] },
    { "kind": "display", "text": "Machined, not assembled.", "slot": "center-left", "enter": [0.14, 0.4], "exit": [0.8, 0.94] }
  ]
}
```

Then scene 2 — and here is the trick that makes it feel like one film: **reuse
`"id": "hero"`** with `"opacity": 1, "hold": true, "enter": [0, 0.01]`. It never
fades; only the camera changes.

### Step 4 — prove it before rendering

```bash
node cli/validate.mjs specs/acme-hero.json        # ✓ parses, storyboard prints
node cli/lint-style.mjs specs/acme-hero.json      # ✓ no style drift, copy fits
node cli/render.mjs specs/acme-hero.json --stills 0.15,0.45,0.8 --size 1280x720
```

Open the three PNGs. This is where you catch, in eight seconds: two headlines in
the same slot, a subject hidden behind type, a black frame, a camera that drifted
out of range, metal that reads as a black hole.

Then a 720p draft to check *motion*, which stills cannot show. Only then the
master.

### Step 5 — deliver

`DELIVERY.md`, twelve lines, honest Risk. Then the handoff in
`references/10 §6`.

---

## 6. The craft rules

Condensed from `references/03`–`07`. Learn these nine and you are competent.

1. **One idea per scene.** If you cannot name it in six words, it is two scenes.
2. **Every scene needs a camera move**, not a camera position. Under 1.5 units of
   travel reads as static.
3. **One styleset.** Colour, type, geometry language, framing — decided once.
4. **One subject carries the film.** Same `id`, every scene.
5. **One metric per film**, and only in the beat that is about that number.
6. **Type is the calmest thing on screen.** If geometry fights type, geometry
   loses.
7. **Alternate intensity.** Fast beat, then still beat. Loud copy, then a
   type-free frame.
8. **End on a held frame.** `hold: true` on the last line, `outroHold` 0.8s.
9. **Cut, don't decorate.** When a beat is weak, remove a thing, not add one.

And the arithmetic you will use daily:

```
reading time  ≈ words / 3.6 + 0.5 seconds
scene length  ≈ reading time / 0.73        (entrances + exits eat 27%)
scene count   ≈ target seconds / 5
```

---

## 7. Your first week

### Day 1 — render before you write

```bash
npm install
npm run render -- specs/demo.json --size 1280x720 --fps 24 --preset medium
```
Watch it. Then run `node cli/inspect.mjs specs/demo.json` and match each row of
the table to a moment in the film. You should be able to explain, for scene 3,
why the camera's `z` goes 3.2 → 0.35.

### Day 2 — break the demo on purpose

Open `specs/demo.json`, and change things one at a time:

- set scene 2's `duration` to 2 → watch the copy become unreadable (the linter
  will have warned you)
- change scene 3's `transition` to `cut` → run the linter, read the error, undo
- remove `hold: true` from `core-wire` → watch the object vanish mid-film
- raise `render.envIntensity` to 2 → watch the metal become plastic

Each break should teach you one rule. This is faster than reading the references.

### Day 3 — copy the demo, change everything but the structure

Make a 3-beat film about something in the room. Keep the skeleton (camera moves,
timing), replace the shapes and words. Re-render. Notice how much of the quality
was in the *skeleton*, not the content — that is the lesson.

### Day 4 — write your own storyboard from a real brief

Ask for a brief (or write one for a product you like). Do the table first. Then
the JSON. Ship it.

### Day 5 — review someone else's spec

Take a spec, run the linter, and find the three things you would change. Write
them as if to the Director, in the three-part form (what you can build · what it
costs · the alternative).

---

## 8. Glossary

| Term | Means |
|---|---|
| **spec** | the JSON file you author; the single source of truth |
| **scene / beat** | one continuous camera move with its cast and copy |
| **story time `t`** | progress through the whole film, 0..1 |
| **scene-relative fraction** | where in a scene something happens, 0..1 |
| **hero** | the object that carries the film, identified by a reused `id` |
| **slot** | one of nine places type can sit in the frame |
| **styleset** | named bundle of palette/type/motion/geometry/framing |
| **fade / dip / cut** | dissolve to background / through a veil colour / instant |
| **veil** | the full-screen colour used during a `dip` |
| **letterbox** | black bars top and bottom, part of the styleset |
| **idle motion** | procedural spin/float/drift on an element, a function of time |
| **scroll ease** | how story progress maps to video time in the export |
| **stills** | PNG frames at chosen story points — your cheapest review tool |
| **poster** | the single frame used as a thumbnail |
| **determinism** | the same spec always produces the same film |

---

## 9. Quality bar and review

A film is **not done** because it rendered. It is done when all five hold:

1. `validate` exit 0, `lint --strict` exit 0
2. three stills read cleanly (no collisions, subject visible, no black)
3. the draft holds attention start to finish at 720p
4. the takeaway is sayable after one watch, muted
5. `DELIVERY.md` exists with a specific `Risk`

**Review protocol.** When reviewing someone's film, in this order:

1. Mute it. Watch once. Can you say the takeaway?
2. Watch again. At what second did you get bored? That beat is the problem.
3. Now look at the stills. Is the type clean? Is the subject on the correct third?
4. Read the spec. Are there two scenes doing the same job? Is any copy saying
   what the picture already says?
5. Read the `Risk` line. Does the author know what is weak? (If they wrote
   "none", they did not look.)

Write review notes as *one* structural note and up to three small ones. Ten notes
means you reviewed your taste, not their film.

---

## 10. Ground rules and escalation

**Never** edit `engine/`, `cli/`, `src/`, `index.html`, `vite.config.js`. If the
framework cannot express the brief, that is a **framework gap** — write it in
`DELIVERY.md` under `Not done` with the failing snippet. Gaps are how the
framework improves; silent workarounds are how it rots.

**Never** ship a render that failed the linter, or that you did not watch.

**Never** promise a capability: footage, real logos, specific typefaces, live
data. The engine draws procedural geometry with theme fonts. Offer the nearest
honest analogue.

**Escalate exactly three things** to the Director: missing intent, an impossible
request, a beat that does not work. Everything else is your decision, and
deciding is the job.

**Record your decisions.** Every time you choose something the brief left open,
it goes in `DELIVERY.md` under `Changed`. A decision nobody recorded is a bug
waiting to be blamed on you.

---

*Fermed 0.1.0 · Visual line skill · keep this file and `SKILL.md` in sync when the
framework changes.*
