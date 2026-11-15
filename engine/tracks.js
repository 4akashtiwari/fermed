/*
 * Fermed tracks — the deterministic core.
 *
 * A track is one scalar over story time: a list of keyframes
 *   { key, from, to, start, duration, ease }
 * evaluated as a pure function of `t`. No state, no accumulation, no library
 * internals: `valueAt(t)` returns the same number for the same t, forever, in
 * any order, forwards or backwards.
 *
 * This replaced a GSAP-driven timeline. GSAP is a superb animation engine, but
 * its rendering is stateful: a tween caches its start value the first time the
 * playhead reaches it and re-applies `from` when the playhead crosses back into
 * it, so seeking backwards into an already-visited region returned values from
 * a different moment. That is invisible while scrolling forward and shows up
 * the first time anything scrubs — including our own renderer, which seeks
 * frame by frame. Determinism is the product here, so the timeline is math.
 *
 * Ease strings stay in the GSAP vocabulary (`power2.inOut`, `expo.out`, …) so
 * specs read the same and workers do not need a second language; we evaluate
 * them ourselves.
 */

import { clamp } from './util.js';

// ---------------------------------------------------------------- easings
// Penner-style curves matching the GSAP names used across the specs.
const pow = (n) => ({
  in: (t) => t ** n,
  out: (t) => 1 - (1 - t) ** n,
  inOut: (t) => (t < 0.5 ? (2 * t) ** n / 2 : 1 - (-2 * t + 2) ** n / 2),
});

const expoIn = (t) => (t === 0 ? 0 : 2 ** (10 * t - 10));
const expoOut = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
const expoInOut = (t) => (t === 0 ? 0 : t === 1 ? 1
  : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2);

const circIn = (t) => 1 - Math.sqrt(1 - t * t);
const circOut = (t) => Math.sqrt(1 - (t - 1) ** 2);
const circInOut = (t) => (t < 0.5
  ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2
  : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2);

const sineIn = (t) => 1 - Math.cos((t * Math.PI) / 2);
const sineOut = (t) => Math.sin((t * Math.PI) / 2);
const sineInOut = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

// back: overshoot controlled by the classic 1.70158 constant, matching GSAP's default
const BACK = 1.70158;
const backIn = (t) => (BACK + 1) * t ** 3 - BACK * t ** 2;
const backOut = (t) => 1 + (BACK + 1) * (t - 1) ** 3 + BACK * (t - 1) ** 2;
const backInOut = (t) => (t < 0.5
  ? ((2 * t) ** 2 * ((BACK * 1.525 + 1) * 2 * t - BACK * 1.525)) / 2
  : ((2 * t - 2) ** 2 * ((BACK * 1.525 + 1) * (t * 2 - 2) + BACK * 1.525) + 2) / 2);

const elasticOut = (t) => (t === 0 || t === 1 ? t
  : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1);

function bounceOut(t) {
  const n = 7.5625; const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

const POW = { 1: pow(1), 2: pow(2), 3: pow(3), 4: pow(4), 5: pow(5) };

const EASE_FNS = {
  none: (t) => t,
  linear: (t) => t,
  'power1.in': POW[1].in, 'power1.out': POW[1].out, 'power1.inOut': POW[1].inOut,
  'power2.in': POW[2].in, 'power2.out': POW[2].out, 'power2.inOut': POW[2].inOut,
  'power3.in': POW[3].in, 'power3.out': POW[3].out, 'power3.inOut': POW[3].inOut,
  'power4.in': POW[4].in, 'power4.out': POW[4].out, 'power4.inOut': POW[4].inOut,
  'power5.in': POW[5].in, 'power5.out': POW[5].out, 'power5.inOut': POW[5].inOut,
  'expo.in': expoIn, 'expo.out': expoOut, 'expo.inOut': expoInOut,
  'circ.in': circIn, 'circ.out': circOut, 'circ.inOut': circInOut,
  'sine.in': sineIn, 'sine.out': sineOut, 'sine.inOut': sineInOut,
  'back.in': backIn, 'back.out': backOut, 'back.inOut': backInOut,
  'elastic.out': elasticOut,
  'bounce.out': bounceOut,
  // "slow(a,b,slowEnd)" — a long slow tail, the house easе for idle drifts.
  'slow(0.7,0.7,false)': (t) => 1 - (1 - t) ** 1.7,
  'slow(0.7,0.7,true)': (t) => t ** 1.7,
  'slow(0.5,0.5,true)': (t) => t ** 1.5,
};

/** Resolve an ease name to a function; unknown names fall back to power2.inOut. */
export function easeFn(name, fallback = 'power2.inOut') {
  return EASE_FNS[name] || EASE_FNS[fallback] || EASE_FNS['power2.inOut'];
}

// ---------------------------------------------------------------- tracks
/**
 * One keyframed scalar.
 *   key      identifies the channel (e.g. "camera.position.0")
 *   from/to  start and end value
 *   start    absolute start time in seconds
 *   duration absolute duration in seconds
 *   ease     one of the ease names above
 */
export function makeTrack({ key, from, to, start, duration, ease = 'power2.inOut' }) {
  return Object.freeze({
    key,
    from,
    to,
    start,
    duration: Math.max(1e-6, duration),
    ease,
    end: start + Math.max(1e-6, duration),
  });
}

/** Value of one track at absolute time t. Pure. */
export function trackValue(track, t) {
  const { from, to, start, duration, end } = track;
  if (t <= start) return from;
  if (t >= end) return to;
  const p = clamp((t - start) / duration, 0, 1);
  return from + (to - from) * easeFn(track.ease)(p);
}

/**
 * A named collection of tracks sharing one key prefix, plus "hold" segments:
 * windows in which the channel keeps the value it has at that time.
 *
 * `hold(from,to)` is how opacity is expressed ("invisible until 40% of the
 * scene, then fade in"), which avoids the set-then-tween dance GSAP needed.
 */
export class Channel {
  constructor(key) {
    this.key = key;
    this.segments = []; // { kind:'tween', track } | { kind:'hold', from, to }
    this.initial = 0;
  }

  /** Base value before any track applies. */
  from(value) {
    this.initial = value;
    return this;
  }

  tween(from, to, t0, duration, ease) {
    this.segments.push({ kind: 'tween', track: makeTrack({ key: this.key, from, to, start: t0, duration, ease }) });
    this.segments.sort((a, b) => segmentStart(a) - segmentStart(b));
    return this;
  }

  hold(from, to) {
    this.segments.push({ kind: 'hold', from, to });
    this.segments.sort((a, b) => segmentStart(a) - segmentStart(b));
    return this;
  }

  /** Pure evaluation at absolute time t. */
  at(t) {
    let value = this.initial;
    for (const seg of this.segments) {
      if (seg.kind === 'tween') {
        if (t < seg.track.start) continue; // not reached yet: keep previous segment's value
        value = trackValue(seg.track, t);
        if (t < seg.track.end) return value; // inside this tween: it owns the value
      } else if (t >= seg.from && t <= seg.to) {
        // hold: keep whatever we have
      }
    }
    return value;
  }

  /** Sample the whole channel over N points — used by tests and inspect. */
  sample(n = 20, total = this.duration) {
    const out = [];
    for (let i = 0; i <= n; i++) out.push([(i / n) * total, this.at((i / n) * total)]);
    return out;
  }
}

function segmentStart(seg) {
  return seg.kind === 'tween' ? seg.track.start : seg.from;
}

/** Summary of what a channel does, for `fermed inspect`. */
export function describeChannel(channel) {
  return channel.segments.map((s) => (s.kind === 'tween'
    ? `${s.track.start.toFixed(2)}–${s.track.end.toFixed(2)} ${s.track.from}→${s.track.to} (${s.track.ease})`
    : `hold ${s.from.toFixed(2)}–${s.to.toFixed(2)}`));
}

export { EASE_FNS };
