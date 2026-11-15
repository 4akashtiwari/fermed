/*
 * Fermed layout check.
 *
 * The linter can reason about words and camera numbers, but two of its rules —
 * "no copy collisions" and "nothing clips the frame edge" — depend on rendered
 * type metrics. This module makes them mechanical:
 *
 *   1. the overlay measures, per visible copy block, the box its text occupies
 *   2. this file tests those boxes pairwise and against the safe area
 *   3. `fermed check:layout` calls it across aspects and story points
 *
 * Pure functions only, no DOM access, so it runs in Node and in the browser.
 */

const AREA_EPS = 4; // px² — ignore sub-pixel hairline touches

export function intersectArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function contains(outer, inner, tol = 1) {
  return inner.x >= outer.x - tol
    && inner.y >= outer.y - tol
    && inner.x + inner.w <= outer.x + outer.w + tol
    && inner.y + inner.h <= outer.y + outer.h + tol;
}

/**
 * @param {Array<{id, sceneIndex, slot, box, content, opacity}>} blocks
 *        `box` = the slot's rect, `content` = where the text actually landed
 * @param {{x,y,w,h}} safe  the safe area for this frame
 * @param {{width,height}} frame
 * @returns {Array<{kind, severity, message, ids}>}
 */
export function detectLayoutIssues(blocks, safe, frame = {}) {
  const issues = [];
  const visible = blocks.filter((b) => b.opacity > 0.04 && b.content.w > 0 && b.content.h > 0);

  // 1. copy meeting copy
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i];
      const b = visible[j];
      const area = intersectArea(a.content, b.content);
      if (area <= AREA_EPS) continue;
      const pct = Math.round((area / Math.min(a.content.w * a.content.h, b.content.w * b.content.h)) * 100);
      issues.push({
        kind: 'collision',
        severity: pct > 18 ? 'error' : 'warn',
        ids: [a.id, b.id],
        message: `copy "${a.id}" and "${b.id}" overlap by ${pct}% of the smaller block (slots: ${a.slot}, ${b.slot})`,
        hint: a.slot === b.slot
          ? 'same slot: use one slot per scene, or stagger the exits'
          : `different slots that collide in this frame — give one a responsive slot, e.g. "slot": {"16:9":"${a.slot}","default":"top-center"}`,
      });
    }
  }

  // 2. copy leaving the safe area (clipping / under the letterbox)
  for (const b of visible) {
    if (contains(safe, b.content, 1.5)) continue;
    const over = Math.round(Math.max(
      safe.x - b.content.x,
      safe.y - b.content.y,
      b.content.x + b.content.w - (safe.x + safe.w),
      b.content.y + b.content.h - (safe.y + safe.h),
    ));
    issues.push({
      kind: 'overflow',
      severity: over > 12 ? 'error' : 'warn',
      ids: [b.id],
      message: `copy "${b.id}" overflows the safe area by ${over}px${frame.width ? ` at ${frame.width}×${frame.height}` : ''}`,
      hint: 'shorten the line, drop to a smaller kind (display → lead), or move it to a centre slot',
    });
  }

  // 3. copy taller than its slot (the column grew past its band)
  for (const b of visible) {
    if (b.content.h <= b.box.h + 2) continue;
    issues.push({
      kind: 'slot-overflow',
      severity: 'warn',
      ids: [b.id],
      message: `copy "${b.id}" is ${Math.round(b.content.h)}px tall inside a ${Math.round(b.box.h)}px slot`,
      hint: 'too many blocks stacked in one slot, or a lead that should be a caption',
    });
  }

  return issues;
}

/** Compact one-line-per-issue report, used by the CLI. */
export function formatIssues(issues, label = '') {
  if (!issues.length) return `${label}✓ no layout issues`;
  const head = `${label}${issues.filter((i) => i.severity === 'error').length} error(s), `
    + `${issues.filter((i) => i.severity === 'warn').length} warning(s)`;
  const lines = issues.map((i) => `  ${i.severity.padEnd(5)} ${i.message}\n         → ${i.hint}`);
  return [head, ...lines].join('\n');
}
