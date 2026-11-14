# 10 — Director brief: template, and how to fix a bad one

You are downstream of a Director agent. This file is both the template you can
send back and the translator for briefs that arrive as vibes.

---

## 1. The template (send this to the Director)

```markdown
BRIEF
  Project:        <client> — <project name>
  Audience:       <who, where they are, what they already know>
  Takeaway:       <the one sentence they must be able to repeat tomorrow>
  Feeling:        <3 adjectives max, e.g. "precise, expensive, calm">
  Subject:        <the thing on screen: a product, an idea, a number, a process>
  Forbidden:      <claims, competitors, words, imagery to avoid>
  Brand:          <must-use colour/type/logo, or "none — your call">

BEATS                                (3–6, in order, one sentence each)
  1. <beat>
  2. <beat>
  3. <beat>

DELIVERY
  Style:          <one of: editorial-noir | chrome-bloom | bone-archive |
                   night-signal | solar-clay | void-mono | your call>
  Duration:       <target seconds, with min/max>
  Outputs:        <mp4 | site | stills | all>
  Aspect:         <16:9 default | 9:16 | 1:1>
  Audio:          <silent | music | voice — Motion line owns this unless stated>

ASSETS
  <files or links, or "none — procedural only">

APPROVAL
  Sign-off by:    <name/agent>
  They will judge: <what they will look at, and what would make them say no>
  Deadline:       <date> · revisions available: <n>
```

---

## 2. Converting a bad brief

### "Make something cool for our startup"

| Missing | Ask exactly this |
|---|---|
| audience, takeaway, subject, feeling, duration | "I need three things to start: (1) the one sentence a viewer should remember, (2) what the product actually does in plain words, (3) 15s, 30s or 45s. Send those and I'll storyboard in 10 minutes." |

Do not ask for all twelve questions. Ask the three that unblock the most.

### "It's like the Apple one but for us"

Ask: "Which part of the Apple piece — the camera calm, the dark palette, or the
type scale? I can match one of those exactly; matching the mood generally will
look like a copy."

Then translate: camera calm → `power2.inOut` everywhere, 6s scenes,
`scroll.pxPerSecond` 140. Dark palette → `editorial-noir` or `void-mono`.
Type scale → `display` at 9 words max, `lead` cut to one line.

### "Here's the deck, make it a film"

Read the deck for the *argument*, not the slides. A 24-slide deck has 3 beats.
Reply with the beat list for confirmation before writing JSON:

> "From the deck I read three beats: (1) the problem is invisible, (2) our
> approach makes it visible, (3) here's the proof. 25 seconds, `night-signal`.
> The other slides I'd cut — they're support material, not story. Confirm or
> correct."

### "Just make it, I trust you"

That is permission, not information. Take the decision rights, then state them:

> "Taking it. Assumptions: audience = technical buyers, takeaway = 'your data is
> already telling you this', style = `night-signal`, 25s, silent, 16:9. If any of
> those are wrong, tell me now — after the render they cost a full redo."

### "Can we add the logo animating in?"

Fermed has no bitmap loader and no vector animation. The nearest legitimate
answers:
1. a `text3d` slab of the wordmark, extruded and lit (works for wordmarks)
2. a geometric mark built from 2–3 primitives (circles, boxes) in the accent
3. leave the frame clear in the last second so Motion can composite the logo

Offer those three. Do not promise a real logo render.

### "It needs to be 10 seconds"

Below 12s, structure collapses. Reply with the arithmetic: "10s at the minimum
readable scene length is 3 beats of 3.3s, which leaves ~2.5s of reading time per
beat — enough for 6 words. If you can live with 3 × 6-word headlines and no
leads, yes. Otherwise 15s."

---

## 3. Questions worth asking vs questions worth deciding

**Ask** (cheap for them, unblocks you):
- the takeaway sentence
- audience
- duration band
- forbidden claims
- whether a specific styleset is mandated

**Decide** (do not ask, just report):
- exact word count of a headline within the brief's meaning
- camera positions, easings, shapes, materials
- which of two equally valid stylesets (pick the more readable, say why)
- slot placement, stagger, idle motion
- poster frame choice

**Never ask** (it signals you have not read this skill):
- "what should the JSON look like?"
- "which shape should I use?"
- "how long should a scene be?"

---

## 4. Pushing back well

Three-part structure: **what you can build · what it costs · the alternative.**

> "A continuous 40-second single-take orbit (what the brief describes) is
> buildable, but at that length an unbroken orbit reads as a screensaver and the
> copy has to loop. Option A: five beats, 26s, one orbit in beat 2 only — the
> strongest version. Option B: 40s single take with three copy changes, if the
> unbroken feel is the point. I'd ship A. Say the word or I'll build A."

Never present a problem without two options. Never present options without a
recommendation.

---

## 5. Reading a brief's real requirement

| They say | They usually mean | Build |
|---|---|---|
| "premium" | slow, dark, few elements, one accent | `chrome-bloom`/`editorial-noir`, 5s+ scenes, ≤4 elements |
| "energetic" | shorter scenes, faster camera | 4s scenes, more travel, `power3.inOut` |
| "explain it simply" | fewer beats, plainer copy | 3 beats, `lead` copy only, `subject` at centre |
| "make it pop" | contrast and a hero moment | one macro reveal beat, `accent` emissive, vignette up |
| "like a film trailer" | dips to black, held frames, big type | `dip` transitions, `void-mono`, 3–4 word displays |
| "we need it on the website" | scroll pacing matters | set `pxPerSecond` 160–200, test the scroll feel |
| "social" | vertical, silent, faster | 9:16, 4s scenes, larger type, no leads over 12 words |

---

## 6. The handoff back (copy this)

Fill it, keep it under 15 lines.

```markdown
DELIVERED — <project>

Files     specs/<slug>.json · out/<slug>.mp4 · out/<slug>-poster.png
Runtime   <N>s · <N> beats · <styleset>
Reads as  <one sentence: what a stranger would say this is about>
Beats     1 <id> <N>s · 2 <id> <N>s · …
Decided   <the open questions you closed, e.g. "styleset; shortened headline 2 to 7 words">
Risk      <the weakest beat + the two fixes you'd try>
Not done  <anything out of scope, so nobody assumes it exists>
Re-render node cli/render.mjs specs/<slug>.json
```

Send that even when the job went perfectly. It is how the Director learns what
they can ask you for next time.
