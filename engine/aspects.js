/*
 * Fermed aspects.
 *
 * Frame shapes the renderer supports out of the box. `render.aspect` is a
 * convenience: it sets the pixel size unless the spec also sets explicit
 * width/height (explicit always wins — a spec that knows its size should never
 * be silently resized).
 */

export const ASPECT_PRESETS = {
  '16:9': { width: 1920, height: 1080, note: 'site hero, YouTube, decks' },
  '9:16': { width: 1080, height: 1920, note: 'reels, stories, shorts' },
  '1:1': { width: 1440, height: 1440, note: 'feed posts' },
  '4:5': { width: 1440, height: 1800, note: 'portrait feed' },
  '2.39:1': { width: 1920, height: 804, note: 'cinemascope, film titles' },
  '4:3': { width: 1440, height: 1080, note: 'legacy / projector' },
};

export const ASPECT_NAMES = Object.keys(ASPECT_PRESETS);

export function aspectSize(name) {
  const p = ASPECT_PRESETS[name];
  if (!p) return null;
  return { width: p.width, height: p.height };
}

/** Which framing defaults to nudge for a vertical frame. */
export function aspectHints(name) {
  if (!name) return {};
  const [a, b] = name.split(':').map(Number);
  const ratio = a / b;
  if (ratio < 0.8) {
    // vertical: the letterbox eats the few horizontal bands you have, and type
    // needs to sit above the subject rather than beside it.
    return {
      letterbox: 0.03,
      vignette: 0.32,
      note: 'vertical frame: prefer top-center / bottom-center copy slots and a taller camera pull-back (+25% z)',
    };
  }
  if (ratio > 2.1) {
    return {
      letterbox: 0,
      vignette: 0.55,
      note: 'cinemascope: copy must be one short line; push the subject to a third, not the centre',
    };
  }
  return {};
}
