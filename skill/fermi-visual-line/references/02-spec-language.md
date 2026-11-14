# 02 — The spec language (complete reference)

Every field, every default, every limit. This is the file to keep open while
authoring. If a field is not listed here, it does not exist and the validator
will reject it (the schema is `.strict()` on purpose — typos must fail loudly).

Units: **positions are world units** (subject is ~1–2 units across, camera sits
3–10 units away). **Times are scene-relative fractions 0..1** unless the field
name says seconds. **Angles are radians** in `transform`, degrees in `fov`.

---

## Top level

```jsonc
{
  "$schema": "../engine/spec.schema.json",   // optional, editor hint
  "meta":      { … },     // required
  "styleset":  "…",       // required
  "theme":     { … },     // optional per-project overrides
  "render":    { … },     // optional, defaults below
  "scroll":    { … },     // optional, defaults below
  "export":    { … },     // optional, defaults below
  "music":     { … },     // optional
  "scenes":    [ … ]      // required, 1–14
}
```

### `meta`
| Field | Type | Limits | Notes |
|---|---|---|---|
| `title` | string | required | window title, and the default slug source |
| `subtitle` | string | — | not rendered on screen by default |
| `client` | string | — | for DELIVERY.md |
| `author` | string | — | default `Fermi / Visual Line` |
| `slug` | string | auto | filename stem for site + mp4 |
| `brief` | string | ≤2000 | **required by the linter.** The Director's intent, verbatim-ish |

### `render`
| Field | Default | Range | Notes |
|---|---|---|---|
| `width` | 1920 | 320–3840 | film width |
| `height` | 1080 | 240–2160 | 16:9 unless the brief says otherwise |
| `fps` | 30 | 12–60 | 24 = cinema, 30 = web |
| `pixelRatioCap` | 2 | 1–3 | leave at 2 |
| `exposure` | 1.0 | 0.2–3 | 0.9 brooding, 1.15 airy |
| `fog` | 0.035 | 0–0.4 | 0.02–0.03 for wide shots, 0.06 for interiors |
| `ambient` | 0.35 | — | fill light; lower = more dramatic |
| `envIntensity` | 1.15 | 0–2 | **raise this first if metal looks black** |

### `scroll` (the website behaviour)
| Field | Default | Notes |
|---|---|---|
| `pxPerSecond` | 180 | how much scrolling buys one second of story. 140 = slow/cinematic, 260 = brisk |
| `lerpDuration` | 1.1 | scroll smoothing |
| `smooth` | true | turn off for reduced-motion parity tests |
| `wheelMultiplier` | 1 | ~1 is right; 1.4 feels floaty |
| `touchMultiplier` | 1.6 | mobile |

### `export` (the film)
| Field | Default | Notes |
|---|---|---|
| `scrollEase` | `inOutCubic` | how story-progress maps to video time. `linear` = literal scroll, `inOutCubic` = the way a human scrolls |
| `introHold` | 0.25 | seconds of still frame at the head |
| `outroHold` | 0.6 | seconds at the tail — always end on a held composition |
| `format` | `mp4` | `mp4` (h264) |
| `crf` | 18 | 16 = master, 18 = deliverable, 22 = draft |
| `preset` | `slow` | x264 preset; `medium` halves render time |

### `music`
| Field | Default |
|---|---|
| `src` | path relative to the spec file |
| `volume` | 0.6 |
| `fadeIn` / `fadeOut` | 1 / 1.5 seconds |

Motion usually owns sound. Only use this for scratch or social cuts.

### `theme` (optional overrides)
Rarely needed. Any key here overrides the styleset:

```jsonc
"theme": {
  "palette": { "accent": "#c4632f" },      // keep it to 1–2 keys
  "framing": { "letterbox": 0.06, "grain": 0.05 },
  "motion": { "speed": 0.9 }               // global rhythm scale
}
```
Full key list in `06-stylesets.md`.

---

## `scenes[]` — the story

| Field | Type | Limits | Default |
|---|---|---|---|
| `id` | string | semantic word | `scene-N` |
| `label` | string | ≤80 chars | — | for humans, shows in `inspect` |
| `duration` | number | 1–20 | 4 | seconds |
| `transition` | enum | `cut` \| `fade` \| `dip` | `fade` |
| `veilColour` | hex | — | theme bg | colour the veil passes through |
| `camera` | object | see below | inherits previous end |
| `elements` | array | ≤24 defined, ≤8 visible | `[]` |
| `copy` | array | ≤6 | `[]` |

### `camera`
Two shapes. Use the short one when the scene continues the previous move.

```jsonc
"camera": {
  "from": { "position": [x,y,z], "lookAt": [x,y,z], "fov": 40 },
  "to":   { "position": [x,y,z], "lookAt": [x,y,z], "fov": 38 },
  "ease": "power2.inOut",
  "shake": 0
}
```
| Field | Notes |
|---|---|
| `position` | where the camera is. +Z toward the viewer, −Z into the scene |
| `lookAt` | the point it is aimed at — usually `[0,0,0]` or the subject |
| `fov` | degrees. 35–45 normal, 55–70 wide/urgent, 22–30 compressed/clinical |
| `ease` | any ease from §Easings. `power2.inOut` is the house default |
| `shake` | 0–3. 0.15–0.3 adds a documentary handheld feel. Use sparingly |

If `from` is omitted, the camera continues from the previous scene's `to` —
which is what you want most of the time.

### `elements[]`
| Field | Type | Notes |
|---|---|---|
| `id` | string | **reuse an id across scenes to carry the same element forward** |
| `label` | string | for humans |
| `shape` | enum | see the shape table below |
| `geometry` | object | numbers passed to the shape; see table |
| `material` | enum | `solid`, `accent`, `glass`, `wire`, `ghost`, `topographic` |
| `materialOptions` | object | `color`, `emissive`, `emissiveIntensity`, `metalness`, `roughness`, `opacity`, `transmission`, `flatShading` |
| `position`/`rotation`/`scale` | shorthand | start transform, same as `transform.from` |
| `transform.from` / `.to` | object | `position`, `rotation`, `scale` (scale may be a number) |
| `to` | object | shorthand for `transform.to` |
| `motion` | object | procedural idle: `spin`, `float`, `drift`, `orbit`, `pulse`, `opacityFlicker` |
| `enter` | `[a,b]` | scene fractions for opacity in. default `[0,0.18]` |
| `exit` | `[a,b]` | default `[0.86,1]` |
| `opacity` | 0–1 | held opacity, default 1 |
| `opacityIn` / `opacityOut` | 0–1 | default 0 |
| `hold` | boolean | `true` = never fade out; stays to the end of the scene |
| `ease` | ease string | transform ease; default = camera ease |
| `seed` | number | offsets the idle motion so twins don't sync |
| `renderOrder` | number | rarely needed |

**Element identity rule:** the first scene that defines an `id` fixes its shape
and material forever. Later scenes reuse the id to re-pose it. This is how the
hero object survives a camera move — you never re-create it.

### `copy[]`
| Field | Type | Limits | Default |
|---|---|---|---|
| `id` | string | — | auto |
| `kind` | enum | `display` \| `lead` \| `metric` \| `eyebrow` | `display` |
| `text` | string | display ≤9 words, lead ≤34 | required |
| `suffix` | string | ≤12 | metric only (`%`, `m`, `×`) |
| `eyebrow` | string | ≤64 | small caption *above* this block |
| `caption` | string | ≤200 | small note *below* this block |
| `rule` | boolean | — | hairline above |
| `slot` | enum | 9 slots | `center-left` |
| `enter` / `exit` | `[a,b]` | must not overlap | `[0.1,0.26]` / `[0.84,0.96]` |
| `stagger` | 0–0.5 | per-word delay | 0.035 |
| `ease` | ease | — | `expo.out` |
| `hold` | boolean | — | `false` |

Slots: `top-left`, `top-center`, `top-right`, `center-left`, `center`,
`center-right`, `bottom-left`, `bottom-center`, `bottom-right`.

**Slot rule:** items in the same slot stack as a column, in array order. More
than 3 in one slot is a lint error. A scene with copy in `center-left` and
`center-right` and nothing else is a layout, not a story — use the third slot
sparingly.

---

## Shape vocabulary

| `shape` | `geometry` keys (defaults) | Use for |
|---|---|---|
| `box` | `w`1 `h`1 `d`1 | products, chips, architectural mass |
| `sphere` | `r`0.7 `widthSeg`48 `heightSeg`32 | planets, cells, calm |
| `icosahedron` | `r`0.8 `detail`0 | the house "idea" object |
| `dodecahedron` | `r`0.8 `detail`0 | faceted calm |
| `octahedron` | `r`0.8 `detail`0 | satellites, markers |
| `tetrahedron` | `r`0.9 `detail`0 | shards, dust, debris |
| `torus` | `r`0.6 `tube`0.2 `radialSeg`24 `tubularSeg`96 | orbits, rings, containment |
| `torusKnot` | `r`0.55 `tube`0.16 `tubularSeg`160 `radialSeg`20 `p`2 `q`3 | complexity, "the thing itself" |
| `cone` | `r`0.6 `h`1.4 `seg`48 | direction, ascent |
| `cylinder` | `rTop`0.5 `rBottom`0.5 `h`1.4 `seg`48 | columns, containers |
| `capsule` | `r`0.35 `len`0.8 `capSeg`12 `radialSeg`32 | human-scale, pills |
| `plane` | `w`4 `h`4 | backdrops, surfaces |
| `ring` | `inner`0.4 `outer`0.8 `seg`72 | flat orbits, halos |
| `circle` | `r`0.8 `seg`72 | discs, lenses |
| `tube` | `turns`2 `r`1 `h`3 `tubeR`0.045 `samples`220 | **paths, tunnels, flows — the best storytelling shape** |
| `grid` | `w`20 `h`20 `wSeg`40 `hSeg`40 | floors, terrain, data fields |
| `text3d` | `text` "FERMED" `charW`.34 `charH`.6 `depth`.16 | extruded slab type (not real type) |

## Material vocabulary

| `material` | Looks like | Uses theme |
|---|---|---|
| `solid` | brushed/key light surface | palette.surface + geometry defaults |
| `accent` | glowing theme accent, tighter roughness | palette.accent |
| `glass` | transmission, refraction, thin highlights | palette.text |
| `wire` | wireframe lines | palette.accent |
| `ghost` | faint, no depth write — good for background mass | palette.muted |
| `topographic` | wireframe grid | palette.grid |

---

## Easings

`none` · `power1|2|3|4.in|out|inOut` · `expo.in|out|inOut` · `circ.*` ·
`sine.*` · `back.*` · `elastic.out` · `bounce.out` ·
`slow(0.7,0.7,false)` · `slow(0.7,0.7,true)` · `slow(0.5,0.5,true)`

House picks: `power2.inOut` for camera, `expo.out` for type, `sine.inOut` for
orbits, `power2.in` for exits. Anything `elastic` or `bounce` reads as playful —
confirm the brief allows it.

---

## `motion` — procedural idle

Runs on top of the transform, as a function of absolute time, so it is identical
on every render and scrubs backwards correctly.

```jsonc
"motion": {
  "spin":  [0.02, 0.15, 0],                 // radians per second, per axis
  "float": { "amp": 0.06, "speed": 0.8 },   // vertical sine drift
  "drift": { "amp": 0.2, "speed": 0.4 },    // x/z wander
  "orbit": { "radius": 2.1, "speed": 0.32 }, // circular path (negative = reverse)
  "pulse": { "amp": 0.05, "speed": 2.1 },   // scale breathing
  "opacityFlicker": 0.04                    // 0–0.5, use on glass only
}
```

Rule of thumb: **one** idle motion per element. Two reads as noise. `spin` on
heroes, `orbit` on satellites, `float` on anything that should feel alive.

---

## Validation behaviour you can rely on

- Unknown keys → **error** (typos fail)
- Out-of-range numbers → **error** with the allowed range
- Unknown shape/material/ease/styleset → **error** listing the vocabulary
- Missing `meta.brief` → error from the linter, not the schema
- `enter`/`exit` collision → linter error
- Everything else → warning, and the render still proceeds

Run `node cli/validate.mjs <spec>` to see the computed storyboard, and
`node cli/inspect.mjs <spec>` to see what the camera actually does at each
tenth of the story.
