# 07 — Motion and shape recipes

Copy-paste blocks that already look good. Each recipe says what it is for, what
it costs in attention, and what to change first when it does not work.

Conventions: all values are inside one scene; `enter`/`exit` are scene fractions.

---

## 1. The hero object (every film needs one)

One object carries the whole film. It exists in every scene with the same `id`,
re-posed by each scene's `transform`.

```jsonc
{
  "id": "hero",
  "shape": "icosahedron",
  "geometry": { "r": 1.05, "detail": 1 },
  "material": "solid",
  "materialOptions": { "metalness": 0.55, "roughness": 0.28 },
  "transform": { "from": { "scale": 0.72 }, "to": { "scale": 1 } },
  "motion": { "spin": [0.02, 0.16, 0], "float": { "amp": 0.06, "speed": 0.8 } }
}
```

First scene: `enter: [0, 0.22], opacityIn: 0`.
Every later scene: `"opacity": 1, "enter": [0, 0.01], "hold": true` — no fade, it
simply continues.

Change first if it looks cheap: `detail` 0 → 1 (more facets), roughness up for
matte, down for mirror.

## 2. Orbit rings (containment, system, "this is organised")

```jsonc
{
  "id": "ring-a",
  "shape": "torus",
  "geometry": { "r": 1.9, "tube": 0.012, "tubularSeg": 160 },
  "material": "accent",
  "materialOptions": { "emissiveIntensity": 0.5, "roughness": 0.3 },
  "transform": { "from": { "rotation": [1.35, 0, 0] }, "to": { "rotation": [1.2, 0.6, 0.1] } },
  "motion": { "spin": [0, 0.05, 0] },
  "enter": [0.18, 0.5], "hold": true
}
```

Rules: tube radius 0.008–0.015 (thin = elegant), two rings maximum, tilt each
one differently, never two rings with the same tilt.

## 3. Satellites (life, scale, "there are other things here")

```jsonc
{
  "id": "sat-slow",
  "shape": "sphere",
  "geometry": { "r": 0.14, "widthSeg": 32, "heightSeg": 20 },
  "material": "glass",
  "motion": { "orbit": { "radius": 2.1, "speed": 0.32 } },
  "enter": [0.2, 0.45], "hold": true
}
```

Counter-orbit a second one (`speed: -0.21`) at a different radius so they never
collide visually. Three satellites is plenty; six is a swarm; past six the hero
is lost.

## 4. The tunnel (journey, process, "inside")

```jsonc
{
  "id": "tunnel",
  "shape": "tube",
  "geometry": { "turns": 2.5, "r": 1.5, "h": 9, "tubeR": 0.028, "samples": 260 },
  "material": "accent",
  "materialOptions": { "emissiveIntensity": 0.7 },
  "transform": {
    "from": { "rotation": [1.5708, 0, 0], "position": [0, 0, -2] },
    "to":   { "rotation": [1.5708, 0.5, 0], "position": [0, 0, -3.2] }
  },
  "motion": { "spin": [0, 0, 0.06] },
  "enter": [0.06, 0.3], "hold": true
}
```

`rotation.x = 1.5708` lays the helix along the camera axis. Combine with a
`dolly in + fov widen` camera and `shake: 0.15`. This is the strongest single
recipe in the framework for a "we're going in" beat.

## 5. The topographic floor (ground, scale, data)

```jsonc
{
  "id": "floor",
  "shape": "grid",
  "geometry": { "w": 34, "h": 34, "wSeg": 46, "hSeg": 46 },
  "material": "topographic",
  "materialOptions": { "opacity": 0.2 },
  "position": [0, -2.15, 0],
  "rotation": [-1.5708, 0, 0],
  "enter": [0.1, 0.55], "hold": true
}
```

Always `position.y` around −2 and `rotation.x` −1.5708. Raise camera `y` in the
same scene for the "rise over the field" reveal.

## 6. The rise (growth, metrics, bars)

```jsonc
{
  "id": "bar-1",
  "shape": "capsule",
  "geometry": { "r": 0.12, "len": 1.6 },
  "material": "accent",
  "materialOptions": { "emissiveIntensity": 0.4 },
  "transform": { "from": { "position": [-1.6, -2.0, 0], "scale": [1, 0.05, 1] },
                  "to":   { "position": [-1.6, -0.2, 0], "scale": [1, 1, 1] } },
  "enter": [0.15, 0.5]
}
```

Stagger `enter` by 0.06 per bar; give each a different final `y`. Never animate
`position.y` and `scale.y` in opposite directions — it looks like a glitch.

## 7. The shard field (tension, fragmentation, chaos contained)

```jsonc
{
  "id": "shard-1",
  "shape": "tetrahedron",
  "geometry": { "r": 0.09 },
  "material": "glass",
  "transform": { "from": { "position": [-0.9, 0.5, -1.2], "scale": 0.6 },
                  "to":   { "position": [-1.6, 0.9, -6], "scale": 1.4 } },
  "motion": { "spin": [0.4, 0.9, 0.2], "drift": { "amp": 0.18, "speed": 0.7 } },
  "enter": [0.1, 0.3], "hold": true
}
```

Give each shard a different `seed` so their idle motion desynchronises. Vary
`-0.1` in `to.position.z` per shard for parallax depth.

## 8. The macro reveal (material, craft, awe)

```jsonc
{
  "id": "hero",
  "shape": "torusKnot",
  "geometry": { "r": 0.72, "tube": 0.22, "tubularSeg": 240, "radialSeg": 32 },
  "material": "solid",
  "materialOptions": { "metalness": 0.85, "roughness": 0.14 },
  "motion": { "spin": [0.1, 0.28, 0.05] }
}
```
with camera `z: 1.6 → 1.5`, `fov: 52 → 42`. Mirror metal at macro scale is the
single most premium frame the engine can make; it needs `envIntensity ≥ 1.2`.

## 9. Idle motion menu

| Motion | Reads as | Best on | Avoid on |
|---|---|---|---|
| `spin: [0, 0.15, 0]` | the object is alive | hero | type-adjacent objects |
| `spin: [0.6, 0.3, 0]` | fast tumble | debris | heroes (loses form) |
| `float: {amp:0.06}` | breathing, calm | anything | a beat that must feel urgent |
| `drift: {amp:0.18}` | machinery, currents | shards, satellites | heroes |
| `orbit: {radius, speed}` | system membership | satellites | heroes |
| `pulse: {amp:0.05}` | alive, heart | glass beads | metal masses |
| `opacityFlicker` | signal, fragility | glass only | everything else |

Rule: **one** idle motion per element, chosen from this table, and the same
motion family across a scene. A scene where one thing spins, one floats and one
orbits feels unmanaged.

## 10. Stagger — the cheap upgrade

Any group of elements looks better staggered:

```jsonc
"enter": [0.18, 0.5]   // element 1
"enter": [0.24, 0.56]  // element 2  (+0.06)
"enter": [0.30, 0.62]  // element 3  (+0.06)
```

Same for `exit`. Six elements arriving on one frame is a wall; six arriving over
half a second is a build.

## 11. Element budget

| Scene type | Elements | Materials | Copy blocks |
|---|---|---|---|
| establish | 3–5 | 2 | 2–3 |
| orbit | 4–6 | 2–3 | 2 |
| descend | 3–5 | 2 | 1–2 |
| reveal | 2–4 | 1–2 | 2 |
| resolve | 3–5 | 2 | 1–2 |

Over budget? Delete. The frame does not have to be full to be finished.

## 12. What "cheap" looks like (and the one-line fix)

| Looks cheap | Fix |
|---|---|
| a plain sphere in the centre | facets (`icosahedron detail 1`) or a knot |
| pure RGB colours | use theme palette roles only |
| elements that never move | add one `motion` family |
| everything at the same depth | push the background −4 in Z, fog it |
| wireframe + wireframe + wireframe | one wire element, rest solid |
| type over busy geometry | move the copy slot, or push the subject +Z and dim the background |
| flat lighting | raise `envIntensity`, add an `accent` element as a rim |
