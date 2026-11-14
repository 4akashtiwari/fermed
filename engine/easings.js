/*
 * Fermed easings.
 *
 * Fermed animates through GSAP, so an "ease" in a spec is simply a GSAP ease
 * string. This file is the single source of truth: the schema validates
 * against it and the reference docs are generated from it.
 */

export const EASINGS = [
  // linear
  'none',
  // power / quad / cubic / quart / quint / expo / circ  ×  in|out|inOut
  'power1.in', 'power1.out', 'power1.inOut',
  'power2.in', 'power2.out', 'power2.inOut',
  'power3.in', 'power3.out', 'power3.inOut',
  'power4.in', 'power4.out', 'power4.inOut',
  'expo.in', 'expo.out', 'expo.inOut',
  'circ.in', 'circ.out', 'circ.inOut',
  // sine
  'sine.in', 'sine.out', 'sine.inOut',
  // back / elastic / bounce
  'back.in', 'back.out', 'back.inOut',
  'elastic.out', 'bounce.out',
  // slow-motion helpers (great for camera drifts)
  'slow(0.7,0.7,false)',
  'slow(0.7,0.7,true)',
  'slow(0.5,0.5,true)',
];

export const EASE_SET = new Set(EASINGS);

/** Named presets the human-facing docs refer to. Maps to GSAP strings. */
export const EASE_PRESETS = {
  'film': 'power2.inOut',      // default: calm, camera-like
  'settle': 'expo.out',        // snappy then decelerates: text entrances
  'drift': 'sine.inOut',       // constant-velocity feel: slow orbits
  'punch': 'power4.out',       // hard open, long tail: reveals
  'float': 'slow(0.7,0.7,true)', // long slow-motion tail: hero idles
  'exit': 'power2.in',         // acceleration away: section exits
};

export function resolveEase(name, fallback = 'power2.inOut') {
  if (!name) return fallback;
  return EASE_SET.has(name) ? name : fallback;
}

/**
 * Scroll-pacing curves for MP4 export: how story-progress maps to video time.
 * These are NOT GSAP eases (they run in Node), they're plain math.
 */
export const SCROLL_EASES = {
  linear: (t) => t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

export function resolveScrollEase(name) {
  return SCROLL_EASES[name] || SCROLL_EASES.inOutCubic;
}
