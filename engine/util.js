/* Fermed — small shared helpers. No side effects, safe to import anywhere. */

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inverseLerp = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));

/** Remap v from [inA,inB] to [outA,outB], clamped. */
export function mapRange(v, inA, inB, outA = 0, outB = 1) {
  return lerp(outA, outB, clamp(inverseLerp(inA, inB, v)));
}

export const isBrowser = typeof window !== 'undefined';

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Deterministic hash -> [0,1). Used instead of Math.random so renders repeat. */
export function hash01(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/** Deep-merge plain objects; arrays are replaced, not merged. */
export function deepMerge(base, override) {
  if (!override) return base;
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  if (typeof base !== 'object' || base === null) return override ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out;
}

/** Format seconds as m:ss. */
export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Escape text destined for innerHTML (spec copy is authored, but be safe). */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
