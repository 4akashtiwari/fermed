# 09 — Troubleshooting

Symptom → cause → fix. Ordered by how often it happens.

---

## Render will not start

| Symptom | Cause | Fix |
|---|---|---|
| `spec is invalid:` + a field path | typo, wrong type, or unknown key (the schema is strict) | fix the field; the message names it |
| `unknown shape "torusknot"` | vocabulary is lowercase-exact | `torusKnot` |
| `unknown ease "power2.easeInOut"` | GSAP naming | `power2.inOut` |
| `spec not found` | wrong path or the dev server is serving another root | check `specs/<slug>.json` exists |
| `waitForFunction: Timeout` and a page error about `.color` | an engine bug, not yours | report it; do not edit the engine |
| Playwright: `libnspr4.so: cannot open shared object file` | Chromium's system deps are missing (Linux) | `sudo apt-get install -y libnspr4 libnss3 libgbm1 libasound2t64` etc. — see README §Troubleshooting |
| `ffmpeg exited 1` | usually an odd frame size (must be even) | use an even `--size`, or let it default |

## Frames are wrong

| Symptom | Cause | Fix |
|---|---|---|
| first frame black / blank | elements all start at `opacityIn: 0` and `enter[0] = 0` | give the hero `enter: [0, 0.22]` and `opacity = 1` by 0.22 |
| mid-film black flash | a `dip` transition plus nothing on screen | add an element to the incoming scene with `enter: [0, 0.15]` |
| last frame black | last scene's copy has `exit: [0.9, 1]` and elements faded | set the final copy `hold: true`, `outroHold: 0.8` |
| two lines of type on top of each other | >3 copy blocks in one slot, or two slots visually overlapping at 4:3 | move one block to a different slot |
| type unreadable over geometry | subject is behind the copy slot | move the copy slot, or move the subject (`lookAt`) to the opposite third |
| everything looks flat grey | `envIntensity` too low, or all materials `ghost` | raise `render.envIntensity` to 1.2–1.5 |
| metal is a black hole | no environment light for it to reflect (or `roughness` ~0 + no panels) | raise `envIntensity`; use `material: "accent"` for the hero instead of mirror `solid` |
| scene is a wall of identical wireframes | every element is `material: "wire"` | one wire element per scene, rest `solid`/`ghost` |
| object drifts out of frame | camera `lookAt` fixed while `position.x` moved too far | keep `|position.x| < 5` for a subject at origin, or move `lookAt` with it |
| object huge and clipped | camera closer than the object's radius | check `position.z` vs `geometry.r`; z ≥ 2×r |
| the film looks like a slideshow | scenes have no camera travel (or <1.5 units) | give every scene a real move |
| the film looks like a screensaver | too much idle motion, no camera story | one `motion` per element; camera does the storytelling |

## Motion problems

| Symptom | Cause | Fix |
|---|---|---|
| nausea in a descend | travel > 6 units + `fov` change > 25 in < 4s | lengthen the scene to 5–6s, cap fov change at 25 |
| jump-cut feel under a "fade" | camera `from` far from previous `to` | use `dip`, or match poses |
| the cut looks like a mistake | `cut` with > 0.6 units of jump | use `fade` |
| two scenes feel identical | same camera move, same copy slot, same shapes | change one axis: move the copy to another slot, invert the camera direction |
| nothing happens for a beat | copy exited early and camera is nearly still | give the scene a `metric` or a second element with a late `enter` |
| motion stutters on the site but the MP4 is smooth | browser is weak / too many elements | reduce elements to 4; the export is always smooth because it is off-line |
| idle motion looks random | two motions on one element, or same `seed` on twins | one motion each; vary `seed` |

## Timing problems

| Symptom | Cause | Fix |
|---|---|---|
| a line vanishes before you read it | `exit[0]` too early for its word count | the linter warns; cut words or push `exit[0]` to 0.9 |
| copy arrives before the object | `enter[0]` of the copy < `enter[1]` of the hero | let the subject land first: copy `enter[0]` ≥ hero `enter[1]` |
| the film ends mid-word | last copy `exit` overlaps the timeline end | `hold: true` on final copy |
| the film feels slow | scene durations too long for the copy | 4.5–5.5s scenes; the resolve can be 6 |
| the film feels rushed | < 3s scenes | 3s is the floor for meaning |
| scroll on the site is exhausting | `scroll.pxPerSecond` too low | raise to 220–260, or cut a scene |

## Site vs MP4 disagreements

| Symptom | Cause | Fix |
|---|---|---|
| the MP4 and the site look different | someone edited the engine | revert; report |
| copy is selectable/accessible in the DOM but not in the film | correct and intended | nothing |
| the site is janky, the film is smooth | live GPU cost; the film is off-line | reduce elements/materials; confirm with `--stills` perf |
| reduced-motion users see a static page | correct and intended (pins disabled, copy remains) | nothing |
| scrollbar length feels wrong | `pxPerSecond × total seconds` | that number is the page height; tune `pxPerSecond` |

## Linter errors and what they really mean

| Message | Means | Fix |
|---|---|---|
| `hard cut with a N unit camera jump` | you cut between two different places | use `fade` (<1.4 units) or `dip` |
| `N unit camera jump under a short fade` | the fade cannot cover that distance | `dip`, or bring the poses closer |
| `display copy … is N words — 9 max` | it will wrap into a wall | cut it |
| `metric "…" must be a number` | you put prose in a metric | digits + `suffix` |
| `exclamation mark` / `ellipsis` | house voice | rewrite |
| `N copy blocks in slot` | column overflows the frame | move one block, or split the scene |
| `element "x" hard-codes colour` | style drift | use a palette role or `accent` |
| `exits before it finishes entering` | `exit[0] < enter[1]` | move the exit later |
| `meta.brief is empty` | no record of intent | paste the Director's brief |

## When you are stuck

1. `node cli/inspect.mjs <spec>` — is the camera actually doing what you think?
2. Render a single still at the bad moment: `--stills 0.47`.
3. Duplicate the spec to `/tmp`, and cut the scene to one element + one copy line.
   If the problem survives, it is your camera. If it disappears, add back one
   thing at a time.
4. Check whether the *scene* is the problem or the *transition into it*: render
   the previous scene's final 20% with `--from 0.3 --to 0.42`.
5. If it is genuinely a framework limitation, write it under `Not done` in
   DELIVERY.md with the exact spec snippet that fails. That is a contribution,
   not a failure.
