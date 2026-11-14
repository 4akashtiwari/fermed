# 05 — Copy and voice

The type is the only part of a Fermed film that argues. Everything else
illustrates. Write it last, cut it hardest.

---

## 1. The four copy kinds

| `kind` | Size | Words | Job |
|---|---|---|---|
| `eyebrow` | small caps, mono, accent | 2–5 | section marker or brand tag. Never a sentence |
| `display` | huge serif/grotesk | **≤9** | the idea of the scene, as a claim |
| `lead` | body size, muted | **≤34** | the support: mechanism, detail, proof |
| `metric` | enormous numeral | digits only | the number that carries the beat |

Rules per kind:

- **Display** is a title, not a sentence. If it needs a comma, it is too long.
  No terminal punctuation unless the period is doing work.
- **Lead** is spoken prose. Read it aloud; if you run out of breath, cut it.
- **Metric** text must be digits (`. , : % + − /` allowed); the unit goes in
  `suffix`. One metric per scene, maximum. Two numbers compete.
- **Eyebrow** is optional. A film with an eyebrow in every scene feels like a
  slide deck. Use it to mark real chapters, not scenes.

## 2. The voice

House voice is **plain, declarative, quiet**. It states; it does not sell.

| Write | Not |
|---|---|
| "Every beat is a camera move." | "Our revolutionary engine empowers immersive narratives!" |
| "Metal, glass and emission come from the style set." | "Stunning, next-generation visuals that dazzle." |
| "It is bigger inside." | "You won't believe what's inside." |
| "0.35 m" | "Just 35 tiny centimetres!" |

Enforced bans (the linter errors on the last two): no exclamation marks, no
ellipses, no all-caps sentences over 34 characters, no "…" trailing off. If a
line needs a bang to land, the line is wrong.

## 3. Reading-time arithmetic

A viewer reads display type at roughly **3.6 words per second** and body type
slightly faster, but only after a ~0.5s beat to notice it exists.

```
needed_seconds ≈ words / 3.6 + 0.5
```

| Words | Needs |
|---|---|
| 3 | 1.3s |
| 6 | 2.2s |
| 9 | 3.0s |
| 18 (lead) | 5.5s |
| 30 (lead) | 8.8s |

The linter computes this against your `enter`/`exit` window and warns when a line
is on screen for less time than it needs. Those warnings are not noise — they are
the difference between a viewer reading and a viewer guessing.

**Fix a too-fast line in this order:** cut words → extend `exit[0]` → lengthen
the scene. Never increase the animation speed.

## 4. Slots and layout

Nine slots. The house default is `center-left`: type on the left third, subject
on the right two-thirds.

```
top-left      top-center      top-right
center-left      center      center-right
bottom-left   bottom-center   bottom-right
```

Layout rules:

- **One slot per scene by default.** Two is a layout (e.g. display left, metric
  right). Three is a poster.
- **Never** put copy in a slot where the subject sits. Check a still.
- A field of type reads left-aligned unless the styleset says `center`.
- `bottom-left` is the most "filmic" position for a caption/label; `center` is
  the most poster-like and should be reserved for the resolve.

## 5. Stacking inside one slot

Items in the same slot stack as a column, in array order — eyebrow, display,
lead, caption reads top-to-bottom as authored. So this is correct:

```jsonc
"copy": [
  { "kind": "eyebrow", "text": "04 — Macro", "slot": "bottom-left", "enter": [0.04,0.18], "exit": [0.86,0.98] },
  { "kind": "display", "text": "One object. Fully lit.", "slot": "bottom-left", "enter": [0.12,0.36], "exit": [0.72,0.9] },
  { "kind": "lead",    "text": "Metal and glass come from the style set.", "slot": "bottom-left", "enter": [0.3,0.5], "exit": [0.74,0.92] }
]
```

More than three in a slot is a lint error: the column becomes taller than the
frame. If you need four, you need two scenes.

## 6. Timing windows

`enter: [a, b]` and `exit: [c, d]` are scene-relative fractions.

- Enter over ~0.15–0.25 of the scene. Faster feels like a flicker; slower feels
  like a page load.
- The **display** enters first, the **lead** about 0.15 later. Type that arrives
  all at once reads as one block and loses hierarchy.
- Exit over ~0.1, and always before 1.0 so nothing is clipped by the cut.
- **Stagger the exit** the same way as the entry: eyebrow leaves first.
- Items with `hold: true` never leave — reserve for the final resolve line or a
  persistent caption.

Word-level stagger (`stagger: 0.035`) is the default and gives the
"settling into place" feel. Set it to `0` for a hard, controlled entrance; use
`0.08+` only for a headline of 3–5 words.

## 7. Writing to a beat

Each scene gets **one claim**. The claim is what you would say if the scene had
no picture.

```
scene 1  the object already existed            "Stories that hold their shape."
scene 2  the camera is doing the storytelling   "Every beat is a camera move."
scene 3  proximity creates scale                "Cross the surface."  +  0.35 m
scene 4  the material is the message            "One object. Fully lit."
scene 5  it belongs to someone else now         "Then it hands off."
```

Read down the left column: that is the film. If the column does not make an
argument, no amount of geometry will fix it.

## 8. Cut pass

Before rendering, do one pass where you **delete a third of the words**. Then
answer, for each remaining line:

1. Could a stranger repeat this after one watch? (If no → simplify.)
2. Does the line say something the picture already says? (If yes → cut it.)
3. Is any word doing no work? (Adjectives usually aren't.)

Typical cuts: "very", "really", "truly", "seamless", "powerful", "next-
generation", "solution", "experience", "journey", "unlock", "empower".

## 9. Client copy

If the Director supplies exact copy:

- Do not rewrite it without saying so in `DELIVERY.md`.
- If it breaks the word limits, say which line and by how much, and offer the cut
  version. Do not silently render an unreadable wall.
- Legal/claim wording is untouchable — if it does not fit, the scene gets longer.

## 10. Bilingual and non-English copy

The engine renders whatever UTF-8 text you put in `text`. Caveats:

- Long compound words (German, Finnish) may overflow a `display` block: drop to
  `lead` sizing or shorten.
- Right-to-left scripts render but are **not** layout-mirrored; keep copy in a
  `center` or `center-left` slot and check the still.
- Non-Latin scripts depend on the browser's font stack. Check the still at the
  same size you will render; if glyphs are missing, report it as a framework gap
  rather than substituting a translation.
