# Contributing

Fermed has two very different contributors. Find yours.

---

## If you are a **visual-line worker** (authoring stories)

Your entire job happens in `specs/`. Read
[`skill/fermi-visual-line/SKILL.md`](skill/fermi-visual-line/SKILL.md) first — it
is the contract, and it is short.

The rules:

- **Touch only** `specs/`, `out/`, `DELIVERY.md`
- **Never touch** `engine/`, `cli/`, `src/`, `index.html`, `vite.config.js`,
  `package.json`
- Every spec must pass both gates before it is delivered:

```bash
node cli/validate.mjs specs/<slug>.json
node cli/lint-style.mjs specs/<slug>.json --strict
```

- If the framework cannot express what the brief needs, that is a **framework
  gap**. Write it in `DELIVERY.md` under `Not done`, with the spec snippet that
  fails. Do not patch the renderer to make one film work.

A spec is ready to merge when: both gates pass, three stills read cleanly, the
MP4 plays end to end, and `meta.brief` says what the film actually argues.

---

## If you are an **engine contributor** (changing the framework)

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) first. Then hold these invariants:

### Non-negotiable

1. **Determinism.** Every animated number is a keyframed channel in
   `engine/tracks.js`, evaluated as a pure function of `t`. No `Math.random`, no
   `Date.now`, no wall-clock reads inside `sample`, `render` or `update`, and no
   animation library may own a value that reaches a frame. Any new idle motion is
   a closed-form function of `tSec`. `npm test` proves order-independence.
2. **Parity.** The scroll path and the render path must call the same
   `seek(t) → sample(t) → render/update` chain. If you add a visual effect, it
   goes through that chain or it does not go in.
3. **The schema is a contract.** Adding a field means adding it to
   `engine/schema.js` with a default and documenting it in
   `skill/fermi-visual-line/references/02-spec-language.md` in the same commit.
4. **Layout has one owner.** Where type may live is decided in `engine/frame.js`
   and verified by `engine/framecheck.js`. Do not compute slot geometry anywhere
   else; run `check-layout` after touching either.
5. **Snapshots are plain data.** `sample(t)` returns deep-copied JSON. Never hand
   out engine state.

### Before you push

```bash
npm test                                                          # unit tests, no browser
npm run check                                                     # validate + lint on the demo
npm run check:layout -- specs/demo.json --aspects 16:9,9:16       # measured layout
node cli/render.mjs specs/demo.json --stills 0.15,0.45,0.8 --size 1280x720
node cli/render.mjs specs/demo.json --from 0 --to 0.1 --size 640x360 --out out/_gate.mp4
```

Look at the stills. Look at the clip. If a change alters the demo's look, say so
in the commit message — the demo is the visual regression test.

### Adding to the vocabulary

| Kind | File | Extra steps |
|---|---|---|
| style set | `engine/stylesets.js` | name it for its feel; document in `references/06` |
| shape | `SHAPES` in `engine/geometry.js` | add to the shape table in `references/02` |
| material | `MATERIALS` in `engine/geometry.js` | document the theme mapping |
| ease | `engine/easings.js` | it is also the validator's allow-list |
| idle motion | `applyIdle` + schema `motionSchema` | must be `tSec`-pure; soft cap 3 motions per element |
| copy slot | `engine/frame.js` + schema enum | `check-layout` at 16:9 **and** 9:16 |
| aspect ratio | `engine/aspects.js` | even dimensions (h264); verify narrow-frame slot behaviour |
| CLI flag | `cli/render.mjs` | document in `references/08` and README |

### Adding to the skill

The skill is a product surface, not a README. Keep:

- `SKILL.md` under ~350 lines (it is loaded on every match)
- `references/` one level deep — no reference pointing at another reference
- every rule causal, not aesthetic: say **why**, because the worker has to apply
  judgement

If you add a lint rule, it needs a one-line reason in the file header and a
mention in `references/09-troubleshooting.md`.

---

## Commits

```
engine: force timeline re-render on repeat seeks
engine(geometry): add `helix` shape
specs: add signal-example (night-signal, data-rise pattern)
skill(03): storyboard table gets a transition column
cli: --poster writes a PNG at the midpoint
```

Scope first, lowercase, present tense, no trailing period. One idea per commit.

## Branches

`main` is always renderable. Work on `feat/…`, `fix/…`, `spec/…`. Nothing merges
that fails `npm run check`.

## Assets

Everything Fermed ships is procedural or text. No binary assets in `docs/` beyond
the two demo films and their posters (≤5 MB each, 720p, crf 23). If you want a
real render in the docs, re-run:

```bash
node cli/render.mjs specs/demo.json --size 1280x720 --fps 24 --crf 23 --preset medium \
  --out docs/media/story-zero.mp4 --poster
```
