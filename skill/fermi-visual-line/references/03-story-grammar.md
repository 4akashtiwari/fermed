# 03 — Story grammar

A Fermed film is 20–40 seconds of scroll-driven motion carrying one idea. That
is short enough that structure is not optional. This file gives you the shape
that works, the shapes that fail, and the arithmetic for durations.

---

## 1. The five-beat spine

Most good Fermed stories are five beats. Not because five is magic, but because
each beat does a job that the others cannot.

| Beat | Job | Duration | Camera behaviour | Copy job |
|---|---|---|---|---|
| **1. Establish** | show the subject exists, set the world | 4–6s | slow push in, wide | name the thing; state the premise |
| **2. Orbit** | let the viewer inspect it from another side | 4–6s | arcing lateral move | the mechanism, or the second idea |
| **3. Descend** | go inside / get closer / raise stakes | 3–5s | dolly in, fov widens, dip transition | the tension, or the number |
| **4. Reveal** | the hero image; the thing they remember | 4–6s | slow drift at macro scale | the claim, plainly |
| **5. Resolve** | pull back, restate, end | 5–7s | pull out and rise, or hold | the takeaway, then silence |

Three beats (establish / develop / resolve) is the minimum for a story. Seven is
the practical maximum — beyond that the viewer cannot hold the shape.

## 2. Choosing scene count from duration

| Target length | Scenes | Per-scene |
|---|---|---|
| 15s | 3 | 5s |
| 20s | 4 | 5s |
| 25–30s | 5 | 5–6s |
| 35–40s | 6 | 6s |
| 45s+ | 6–7 | 6–7s |

Do not build a 30s film out of ten 3-second scenes. Under 3 seconds, a viewer
registers motion but not meaning, and the film becomes a slideshow with a
spinning object. Fewer, longer beats always read better.

**Weight the ending.** The resolve beat should be the longest single beat, and it
should end on a held frame (see `exit` and `outroHold`). Films that end while
still moving feel truncated.

## 3. The one-idea test

Before writing JSON, write one line per scene in this form:

```
SCENE 3 / "descend" / 4.5s
IDEA:     the object is bigger on the inside than it looks
MOVE:     dolly from 3.2 to 0.35 on Z, fov 38→68, dip in
COPY:     "Cross the surface." (display) + "0.35m" (metric)
```

If `IDEA` needs a comma, split the scene. If `IDEA` is a description of an
object ("a blue sphere") rather than a claim ("this thing is a system"), you have
a decoration, not a beat — merge it into a neighbour.

## 4. Story patterns that work

Pick one deliberately. These are the load-bearing structures.

### A. Zoom ladder (macro → micro → macro)
Establish wide → orbit → dive to macro → reveal texture → pull back to wide.
Best for: hardware, materials, craft, "look how well made this is".
Risk: nausea if the dive is faster than 4 seconds.

### B. Assembly
Parts drift in from outside the frame and lock into a whole. Establish (empty
space) → parts arrive → assemble → the whole rotates → resolve.
Best for: platforms, products with components, "this is how it's built".
Implementation: give each element its own `position` from far outside the
viewport, and stagger their `enter` windows.

### C. Journey down a path
A `tube` helix as the spine; the camera travels along it; each scene is a segment.
Best for: process, onboarding, a customer journey, supply chain, time.
Implementation: one `tube` element per segment, `hold: true`, camera Z steps back.

### D. Data rise
A `grid` floor becomes terrain; bars/shapes rise from it on `enter`; camera tilts
up. Best for: growth, metrics, climate, scale.
Implementation: `grid` + `capsule`/`box` elements with `transform.to.position.y`
above zero, staggered `enter`.

### E. Contained chaos
Many small shards orbit one still hero object. Cuts between scales.
Best for: security, complexity tamed, orchestration.
Cap the shards at six, or the frame is noise.

### F. The single turn
One object, one continuous 180° orbit, copy changes three times. The most
elegant pattern and the hardest to make interesting: only use it when the object
is genuinely beautiful.

## 5. Story patterns that fail

| Pattern | Why it fails |
|---|---|
| The feature list | each scene is a bullet point; nothing accumulates |
| The identical cut | every scene uses the same push-in; the viewer stops reading motion |
| The infinite zoom | camera only ever moves forward; no return, no rest |
| The empty middle | beats 1 and 5 are strong, 2–4 are filler; cut to three beats |
| The mystery | nothing is ever stated plainly; viewers leave with a mood, no takeaway |
| The double ending | two resolve beats. Pick one; the first is the ending |

## 6. Durations by copy length

Copy and duration are the same decision.

```
display line, 4–6 words   → needs 2.5s on screen
display line, 7–9 words   → needs 3.5s on screen
lead line, 12–20 words    → needs 4.5s on screen
lead line, 20–34 words    → needs 6s on screen
metric                    → needs 1.5s (it is read instantly)
```

Turning that into scene duration: a scene usually spends ~15% of its time
entering and ~12% exiting. So:

```
scene_duration ≈ (reading_time_needed) / 0.73
```

A 9-word headline (3.5s) needs a ~4.8s scene. That is why 5 seconds is the house
default: it fits a headline and a lead comfortably.

## 7. Rhythm and rest

Alternate intensity. A film where every beat is a big move feels like one long
move — nothing registers.

- After a fast descend, put the reveal on a slow drift.
- After a wide establish, cut tight.
- Give the resolve beat the calmest camera in the film.

Also alternate copy density: a scene with three copy blocks should be followed by
one with a single line or none. Silence (type-free frames) is what makes type
feel important.

## 8. The storyboard artefact

Before JSON, produce this table in your scratch file. It takes four minutes and
saves a full render.

```
#  SCENE      DUR   IDEA (≤6 words)              MOVE              COPY              TRANSITION
1  establish  5.0   the system already exists    push 8.4→4.6      premise + lead    cut
2  orbit      5.5   it holds itself together     arc 3.9→-3.4      mechanism         fade
3  descend    5.0   it is bigger inside          dolly 3.2→0.35    number + tension  dip
4  reveal     5.0   this is the material         drift macro       claim             fade
5  resolve    6.0   it hands off                 pull out + rise   takeaway          fade
                                                        TOTAL 26.5s
```

Then write the JSON straight from the table. If a row is hard to fill, the beat
is not ready.

## 9. Adapting a Director's beats

The Director gives you beats as prose. Translate, do not rewrite.

| Director says | You write |
|---|---|
| "open on the product, it should feel premium" | establish, slow push, `chrome-bloom`, muted lead copy |
| "then explain it's modular" | assembly pattern, 4–6 parts arriving, one display line |
| "show the scale — millions of transactions" | data rise, `grid` floor, capsules rising, metric copy |
| "end on the brand line, quiet" | resolve, pull back, single line, hold 1s |
| "30 seconds, for the homepage hero" | 5 beats, 5–6s each, `pxPerSecond` 150–180 |

If a beat cannot be built with procedural geometry (footage, a real product
photo, a person), say so and offer the nearest analogue: a silhouette, an
abstract hero, a typographic beat. Never promise a render of a photo you do not
have.
