# Delivery — Story Zero (reference job)

**Spec** `specs/demo.json` · **Styleset** `editorial-noir`
**Files** `docs/media/story-zero.mp4` (26.5s, 854×480 draft, 20fps) · `docs/media/story-zero-poster.png`
**Reads as** _A single structure is filmed like a character: it is established, inspected, entered, revealed and finally released._
**Beats** 1 establish 5.0s · 2 orbit 5.5s · 3 descend 5.0s · 4 reveal 5.0s · 5 resolve 6.0s
**Director's brief** The reference story shipped with Fermed: prove the whole pipeline on one object.
**Changed** Scene 2/4/5 use `dip` transitions (the linter caught 2.1–4.2 unit camera
jumps under short fades). Lead copy cut to ≤9 words for the reading-time budget.
**Risk** `descend` (beat 3) is the weakest beat: the tube helix is beautiful but the
fov change of 30° in 5s is at the edge of comfort. Two fixes worth trying: cap the
fov at 58 and lengthen to 5.5s, or replace the descend with a lateral
`lookAt` sweep that keeps the subject edge-on.
**Re-render** `node cli/render.mjs specs/demo.json --out out/story-zero.mp4`
**Versions** Fermed 0.1.0 · Node 20 · Chromium 159 (headless shell) · SwiftShader WebGL2
**Render time** ~9 min at 854×480/20 on 2 cores (sandbox); ~3 min at 1080p/30 on a normal machine
**Not done** No audio (Motion line owns sound). `text3d` is an extruded slab, not real
type geometry — the film uses DOM type only.
