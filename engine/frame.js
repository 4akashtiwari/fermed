/*
 * Fermed frame geometry.
 *
 * One pure function that answers "where may type live?" for any frame size.
 * Both the overlay (which lays type out) and the layout checker (which proves
 * nothing collides) call it, so there is exactly one definition of the safe
 * area — the thing that used to be an eyeball check.
 *
 *   safeArea (w, h, framing) → { x, y, w, h }   in CSS pixels
 *   slotBox  (slot, w, h, framing) → { style, rect }
 */

const CAP = 112; // px
const MIN = 24;

/** Padding in px, scaled to the frame but never smaller than a minimum. */
function padding(w, h) {
  const px = Math.max(MIN, Math.min(CAP, w * 0.06));
  const py = Math.max(MIN, Math.min(CAP, h * 0.055));
  return { px, py };
}

export function safeArea(width, height, framing = {}) {
  const { px, py } = padding(width, height);
  const lb = Math.max(0, Math.min(0.25, framing.letterbox ?? 0));
  const top = py + lb * height;
  const bottom = py + lb * height;
  return {
    x: px,
    y: top,
    w: Math.max(1, width - px * 2),
    h: Math.max(1, height - top - bottom),
  };
}

const SLOT_ALIGN = {
  'top-left': ['flex-start', 'flex-start', 'left'],
  'top-center': ['flex-start', 'center', 'center'],
  'top-right': ['flex-start', 'flex-end', 'right'],
  'center-left': ['center', 'flex-start', 'left'],
  'center': ['center', 'center', 'center'],
  'center-right': ['center', 'flex-end', 'right'],
  'bottom-left': ['flex-end', 'flex-start', 'left'],
  'bottom-center': ['flex-end', 'center', 'center'],
  'bottom-right': ['flex-end', 'flex-end', 'right'],
};

/**
 * A slot is a box inside the safe area, with its own alignment. Type inside a
 * slot wraps within that box, which is what makes overlap detectable.
 */
export function slotBox(slot, width, height, framing = {}) {
  const safe = safeArea(width, height, framing);
  const [alignItems, justifyContent, textAlign] = SLOT_ALIGN[slot] || SLOT_ALIGN['center-left'];

  // Slots claim a horizontal band. Vertical placement is done by flexing to the
  // top/centre/bottom of that band, so short copy stays near its corner and
  // long copy grows toward the centre rather than off-screen.
  const row = slot.split('-')[0];
  const band = {
    top: { y: safe.y, h: safe.h * 0.42 },
    center: { y: safe.y + safe.h * 0.24, h: safe.h * 0.52 },
    bottom: { y: safe.y + safe.h * 0.58, h: safe.h * 0.42 },
  }[row] || { y: safe.y, h: safe.h };

  const rect = {
    x: safe.x,
    y: band.y,
    w: safe.w,
    h: band.h,
  };

  // Narrow the box on the side the type is anchored to, so a left-aligned
  // block never stretches under a subject that sits on the right. In a narrow
  // (portrait) frame there is no "other side" to protect, so slots take the full
  // safe width and are separated vertically instead — which is also how
  // vertical video is actually art-directed.
  const narrow = width / height < 1.05;
  const boxW = narrow
    ? safe.w
    : (slot === 'top-center' || slot === 'center' || slot === 'bottom-center'
      ? safe.w * 0.72
      : safe.w * 0.62);

  // The box is positioned inside the safe area by its own alignment. Doing this
  // arithmetic here (rather than with `right: 0` or auto margins) is what keeps
  // right- and centre-aligned type off the frame edge — the bug the layout
  // checker caught on its first run.
  const x = textAlign === 'right'
    ? safe.x + safe.w - boxW
    : textAlign === 'center'
      ? safe.x + (safe.w - boxW) / 2
      : safe.x;

  const style = [
    'position:absolute',
    `left:${x.toFixed(2)}px`,
    `top:${rect.y.toFixed(2)}px`,
    `width:${boxW.toFixed(2)}px`,
    `height:${rect.h.toFixed(2)}px`,
    'display:flex',
    `align-items:${alignItems}`,
    `justify-content:${justifyContent}`,
    `text-align:${textAlign}`,
  ].join(';');

  return { style, rect: { x, y: rect.y, w: boxW, h: rect.h }, align: textAlign };  return { style, rect: { ...rect, w: maxW }, align: textAlign };
}

/**
 * Resolve a copy item's slot for a given aspect.
 *
 *   "center-left"                                  → fixed at every size
 *   { "16:9": "center-left", "9:16": "top-center" } → per-aspect layout
 *
 * Keys are `w:h` strings or the special key `default`. The closest aspect ratio
 * to the frame wins, so a 4:5 frame can fall back to a 9:16 rule.
 */
export function resolveSlot(slot, aspect = 16 / 9) {
  if (!slot || typeof slot === 'string') return slot || 'center-left';
  const entries = Object.entries(slot);
  if (!entries.length) return 'center-left';
  const hasDefault = entries.find(([k]) => k === 'default');
  const candidates = entries.filter(([k]) => k !== 'default');
  const ratioOf = (k) => {
    const [a, b] = k.split(':').map(Number);
    return a && b ? a / b : null;
  };
  // A key only wins if it is genuinely close to the frame. Anything more than
  // ~13% away in log-ratio terms falls through to `default`, so a spec written
  // for 16:9 does not silently apply its side-by-side layout to a phone.
  const TOLERANCE = 0.13;
  let best = null;
  let bestDelta = Infinity;
  for (const [key, value] of candidates) {
    const r = ratioOf(key);
    if (r == null) continue;
    const delta = Math.abs(Math.log(r) - Math.log(aspect));
    if (delta < bestDelta) {
      bestDelta = delta;
      best = value;
    }
  }
  if (best && bestDelta <= TOLERANCE) return best;
  return hasDefault?.[1] || best || 'center-left';
}

/** Everything the checker needs to know about one framed view. */
export function frameModel(width, height, framing = {}) {
  return {
    width,
    height,
    aspect: width / height,
    safe: safeArea(width, height, framing),
    slots: Object.fromEntries(
      Object.keys(SLOT_ALIGN).map((s) => [s, slotBox(s, width, height, framing)]),
    ),
  };
}
