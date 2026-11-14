# 04 — Camera direction

The camera is the only thing that makes a Fermed story feel like film rather than
a rotating diagram. This file is the whole craft of the `camera` block.

Coordinate reminder: `+X` right, `+Y` up, `+Z` toward the viewer. The subject
usually sits at the origin. So `position: [0, 0.6, 8]` is 8 units back, slightly
above centre, looking straight at it.

---

## 1. Distance → shot size

With the default `fov` of 40:

| `position.z` | Shot | Subject occupies | Use for |
|---|---|---|---|
| 12–16 | extreme wide | 10–15% of frame | scale, isolation, a system in a void |
| 8–11 | wide | 25–35% | establish, the world |
| 5–7 | medium | 45–65% | the default. inspection |
| 3–4 | close | 80–100% | intimacy, "this is the thing" |
| 1–2 | macro | overflows frame | texture, material, awe |
| 0.2–0.6 | inside | geometry surrounds camera | descend, transformation |

Start a film at 8–9 and end at 9–14. Films that start tight and end tight feel
airless; the resolve wants room.

## 2. The five moves (learn these, vary them)

**Push in** — `z: 8 → 5`, `lookAt` fixed, `fov` narrows 40 → 36.
Purpose: attention. "Look at this." The house opener.

**Pull out** — `z: 3 → 9`, `y` rises, `fov` widens 42 → 38.
Purpose: closure and scale. "Now you see the whole thing."

**Arc** — `x` travels across while `z` holds, `lookAt` fixed.
Purpose: inspection from another side. `[3.9, 1.1, 2.9] → [-3.4, 0.4, 3.4]`.
This is the beat that makes an object feel three-dimensional.

**Dolly in + fov widen** — `z: 3.2 → 0.35`, `fov: 38 → 68`, `shake: 0.15`.
Purpose: speed without motion blur, "we are going in". The most cinematic move
available and the easiest to overdo.

**Crane / rise** — `y` increases, `z` increases, `lookAt` stays low.
Purpose: reveal of a field or a floor. Combine with a `grid` element.

Anything else is a disguise for one of these five, and usually a worse version.

## 3. Composition: where to put the subject

The copy occupies a slot; the subject must not be behind it.

| Copy slot | Bring the subject to |
|---|---|
| `center-left` | `lookAt: [0.8, 0, 0]`, or shift camera `x` negative |
| `top-left` | `lookAt: [0.6, -0.6, 0]` — subject low-right |
| `center` | subject dead centre, copy above or below (use `top-center` + `bottom-center`) |
| `bottom-left` | `lookAt: [0.7, 0.5, 0]` — subject upper-right |

Rule: **one third of the frame is for type, two thirds for the subject.** Put
the subject on the opposite side of the copy, roughly on a third line.

## 4. Speed and distance

- Under **1.5 units** of travel in a 5s scene reads as "static". If a scene
  feels like a slide, this is why.
- Over **8 units** of travel in a 5s scene, or any travel that crosses the
  subject, feels fast and demands a `dip` transition afterwards.
- **Closest approach matters more than speed**: passing within 0.3 units of a
  surface gives the "inside" feeling without any velocity.
- `fov` change of more than ~18° within one scene reads as a zoom (which is
  sometimes exactly right, and often a mistake).

## 5. Transitions — choosing `cut`, `fade`, `dip`

| Transition | Means | Rule of use |
|---|---|---|
| `cut` | the same world, instantly | only when the camera jump is **< 0.6 units** and fov changes < 5. Implies continuity |
| `fade` | dissolve through the background | default. Camera jump **< 1.4 units** |
| `dip` | travel through black or a veil colour | any jump bigger than 1.4 units, or a change of world/scale |

The linter enforces the numbers; the reason is perceptual. A cut with a 5-unit
jump looks like a mistake, not a cut. `veilColour` lets the dip travel through a
different colour than the background — use the theme's `bg`, or a deep tone for
a "chapter break" feel.

**One dip per film.** Two dips and the film starts feeling like slides.

## 6. `lookAt` is the secret

Most beginners only move `position`. Moving `lookAt` is what makes a shot feel
directed:

```jsonc
// a shot that reveals by turning the head
"camera": {
  "from": { "position": [0, 0.4, 5], "lookAt": [-2, 0.4, 0], "fov": 40 },
  "to":   { "position": [0, 0.4, 5], "lookAt": [2, 0.4, 0],  "fov": 40 }
}
```

The camera never moves, but the subject sweeps across the frame from outside the
left edge. This is the cheapest "wow" in the whole framework — and it composes
beautifully with a copy block on the opposite side.

Also useful: `lookAt` ahead of the object during a descend (`lookAt.z` negative,
into the scene) so the viewer flies *toward* something rather than through
nothing.

## 7. Eases by move

| Move | Ease | Why |
|---|---|---|
| push in | `power2.inOut` | calm acceleration both ends |
| pull out | `power2.out` | leaves quickly, settles slowly |
| arc | `sine.inOut` | constant-feeling travel, no jerk at ends |
| dolly + fov | `power2.inOut` | matches the physical camera feel |
| crane | `power3.out` | the lift should decelerate |
| a slow drift you want to be invisible | `slow(0.7,0.7,true)` | long slow tail, "nothing is happening, beautifully" |

Never `bounce` or `elastic` on a camera. The viewer's inner ear will object.

## 8. Shake

`shake: 0.1–0.3` adds a deterministic handheld drift (it is a function of time,
not noise, so renders repeat). Use it for: descend beats, "documentary" tone,
tension. Never for: resolves, type-heavy scenes, luxury stylesets. `> 0.5` reads
as a broken stabiliser.

## 9. Worked examples

### Establish (opener)
```jsonc
"camera": {
  "from": { "position": [0, 0.55, 8.4], "lookAt": [0, 0, 0], "fov": 40 },
  "to":   { "position": [0.15, 0.2, 4.6], "lookAt": [0, 0, 0], "fov": 36 },
  "ease": "power2.inOut"
}
```
Travel 3.8 units, fov narrows 4°: a confident push. Copy on `center-left`, so
`lookAt.x` stays 0 and the subject sits centre-right of the type. Good.

### Arc (inspection)
```jsonc
"camera": {
  "from": { "position": [3.9, 1.15, 2.9], "lookAt": [0, 0.1, 0], "fov": 38 },
  "to":   { "position": [-3.4, 0.35, 3.4], "lookAt": [0, 0.05, 0], "fov": 44 },
  "ease": "sine.inOut"
}
```
Crosses the front hemisphere; the subject never leaves frame. `transition: "fade"`
is acceptable here only because the *from* pose is close to the previous *to*.

### Descend (the big one)
```jsonc
"transition": "dip",
"veilColour": "#050506",
"camera": {
  "from": { "position": [0, 0.1, 3.2], "lookAt": [0, 0, 0], "fov": 38 },
  "to":   { "position": [0, 0.02, 0.35], "lookAt": [0, 0, -1.4], "fov": 68 },
  "ease": "power2.inOut",
  "shake": 0.15
}
```
Note the `lookAt.z` going negative: we fly *toward* something past the origin.

### Resolve (closer)
```jsonc
"camera": {
  "from": { "position": [0.4, 0.6, 3.0], "lookAt": [0, 0.05, 0], "fov": 42 },
  "to":   { "position": [0, 1.35, 9.2], "lookAt": [0, 0.15, 0], "fov": 38 },
  "ease": "power2.out"
}
```
Rising pull-out. `power2.out` so the last second is almost still — the frame the
poster comes from.

## 10. Debugging a camera

`node cli/inspect.mjs specs/<slug>.json` prints camera position, fov, veil,
visible element count and visible copy count at ten points through the film.
Read it like a shot list:

- `cam xyz` barely changes between rows → the scene is static.
- `visible els` drops to 0 mid-film → something exits early without `hold`.
- `visible copy` is 0 at a scene's midpoint → copy timing is wrong.
- `fov` changes > 15 between two rows inside a scene → intentional zoom, or a bug.
