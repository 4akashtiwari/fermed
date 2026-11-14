# 06 — Style sets

A style set is a named bundle of palette, typography, motion feel, geometry
language and framing. You pick one per spec and never restyle by hand.

Why it exists: consistency is not a taste problem, it is a decision problem. If
every scene re-decides "what colour is the accent", the film drifts. The style
set decides once.

---

## 1. The six house styles

### `editorial-noir` — Editorial Noir
> High-contrast black, warm off-white type, one amber accent. Slow camera, print-magazine gravity.

- **Palette** bg `#0a0a0b` · surface `#141416` · text `#f4f1ea` · muted `#8f8b84` · accent `#e8a33d` · grid `#232326`
- **Type** serif display, sans body, mono eyebrows. Tracking `-0.02em`
- **Geometry** metalness 0.35, roughness 0.42 — brushed, not mirrored
- **Framing** letterbox 6%, vignette 0.45, grain 0.06, copy left
- **Use for** editorial brands, long-form products, anything that wants to be taken seriously
- **Avoid** if the brief is playful or if the palette must be light

### `chrome-bloom` — Chrome Bloom
> Mirror-metal forms on a deep violet void. Luxurious, tech-couture.

- **Palette** bg `#07060d` · surface `#12101f` · text `#f2f0ff` · muted `#8b86a8` · accent `#8f7bff` · grid `#1b1830`
- **Type** grotesk display, sans body. Tracking `-0.03em`, weight 500
- **Geometry** metalness 0.92, roughness 0.14 — genuinely mirror
- **Framing** letterbox 4%, vignette 0.6, grain 0.04, copy centred
- **Use for** luxury tech, hardware, AI products, couture
- **Watch out** mirror metal needs light: keep `envIntensity` ≥ 1.2 or it reads black. Reduce element count — reflections are the content.

### `bone-archive` — Bone Archive
> Paper-white gallery, ink type, ochre accent. Museum catalogue: airy, precise, unhurried.

- **Palette** bg `#f2efe8` · surface `#e6e2d8` · text `#16150f` · muted `#6d6a5f` · accent `#9a6b2f` · grid `#d6d1c4`
- **Type** serif display, sans body. Tracking `-0.01em`
- **Geometry** metalness 0.05, roughness 0.75 — matte
- **Framing** letterbox 8%, vignette 0.12, grain 0.03, copy left
- **Use for** museums, research, archives, quiet premium brands
- **Watch out** light backgrounds reveal ugly silhouettes — that wireframe and `glass` materials read poorly here. Prefer `solid` and `ghost`.

### `night-signal` — Night Signal
> Near-black with electric cyan wireframes. Data-room precision.

- **Palette** bg `#04060a` · surface `#0a1119` · text `#e8f6ff` · muted `#5f7d8c` · accent `#38f2c4` · grid `#10202b`
- **Type** mono display, sans body. Tracking `0.01em`, weight 500
- **Geometry** wireframe on by default, flat shading
- **Framing** letterbox 5%, vignette 0.5, grain 0.05, copy left
- **Use for** infrastructure, security, developer tools, data products
- **Watch out** wireframe everything = visual noise. One `wire` element per scene, the rest `solid`/`ghost`.

### `solar-clay` — Solar Clay
> Terracotta and sand, matte volumes, soft daylight. Warm, human, architectural.

- **Palette** bg `#f6efe7` · surface `#e8dccf` · text `#2a1c14` · muted `#8a6f5e` · accent `#c4632f` · grid `#e0d2c3`
- **Type** serif display, sans body
- **Geometry** metalness 0.02, roughness 0.88 — clay
- **Framing** letterbox 7%, vignette 0.18, grain 0.05, copy left
- **Use for** craft, food, architecture, climate, human-scale products
- **Watch out** accent-on-warm reads low contrast at small sizes — keep accent for eyebrows and thin rules only.

### `void-mono` — Void Mono
> Pure black, white type, zero colour. Brutalist and typographic.

- **Palette** bg `#000000` · surface `#0d0d0d` · text `#ffffff` · muted `#7a7a7a` · accent `#ffffff` · grid `#1a1a1a`
- **Type** condensed grotesk display, sans body. Tracking `-0.035em`, weight 600
- **Geometry** flat shading, matte
- **Framing** letterbox 9%, vignette 0.3, grain 0.08, copy left
- **Use for** art, fashion, manifestos, brutalist brands
- **Watch out** there is no colour to hide behind: composition and copy do all the work. Only use with a Director who can write.

---

## 2. Decision table

| Signal in the brief | Style |
|---|---|
| "serious", "journalistic", "considered", "long-read" | `editorial-noir` |
| "premium", "hardware", "AI", "couture", "luxury tech" | `chrome-bloom` |
| "museum", "archive", "research", "slow", "gallery" | `bone-archive` |
| "infra", "security", "API", "data", "developer" | `night-signal` |
| "human", "craft", "food", "architecture", "climate" | `solar-clay` |
| "brutalist", "manifesto", "fashion", "pure typography" | `void-mono` |

Tie-breakers, in order:
1. Which makes the copy more readable?
2. Which needs fewer elements to look finished?
3. Which will look least dated in two years? (Dark + one accent ages well.)

## 3. What a styleset actually controls

```jsonc
"palette":  { bg, surface, text, muted, accent, grid }
"fonts":    { display, body, mono, weightDisplay, tracking }
"motion":   { speed, cameraEase, copyEase, intensity }
"geometry": { metalness, roughness, flatShading, wireframe }
"framing":  { letterbox, vignette, grain, copyAlign }
```

Mapping to what you see:

| Key | Effect |
|---|---|
| `palette.bg` | background, fog, veil default |
| `palette.surface` | default `solid` material colour |
| `palette.text` | default `glass` tint, light colour |
| `palette.accent` | `accent` material, `wire` lines, eyebrows, metric suffix |
| `palette.grid` | `topographic` material |
| `members.motion.speed` | global rhythm multiplier (0.85 = calmer film) |
| `geometry.*` | defaults for elements that do not specify materialOptions |
| `framing.letterbox` | black bars top and bottom (0–25% each side) |
| `framing.vignette` | edge darkening; high values need centred composition |
| `framing.grain` | film grain; 0.03–0.08 is the useful band |

## 4. Overriding a styleset (the narrow path)

You may override **one or two** keys in `theme` when the client has a house
colour or the letterbox needs to change. Never restyle a whole palette.

```jsonc
"styleset": "editorial-noir",
"theme": {
  "palette": { "accent": "#2a6fdb" },     // client blue replaces the amber
  "framing": { "letterbox": 0.04 }
}
```

Rules:
- Maximum two palette keys per project
- Never override `text` or `bg` unless the brief demands a light or dark inversion —
  and if it does, pick the styleset that already is that instead
- Record the override in `DELIVERY.md` under CHANGED

## 5. Inventing a styleset

Only when a Director asks for a look none of the six cover, and the pattern will
be reused. Add it to `engine/stylesets.js` — that is a framework change, so:

1. Say what you are doing and why in `DELIVERY.md`
2. Copy an existing entry and change **all five blocks** (a half-restyled entry is
   how drift starts)
3. Name it for its feel, not its client (`oxide-tide`, not `acme-brand`)
4. Verify with three stills at 0.2 / 0.5 / 0.85 and check `chrome-bloom`'s warning
   cases (metal without light, light bg with wireframe)

If it is a one-off, do not add a styleset: use `theme` overrides on the closest
house style.

## 6. Style discipline checklist

Before every render:

- [ ] exactly one `styleset` string in the spec
- [ ] no `materialOptions.color` unless it is a palette role or an accent
- [ ] no more than 5 distinct materials across the whole film
- [ ] identical framing across scenes (letterbox does not change mid-film)
- [ ] eyebrows use the accent, never the display colour
- [ ] light or dark chosen once — never mixed
