/*
 * Fermed timeline — the determinism core.
 *
 * Everything the audience sees is a pure function of story time `t` (0..1).
 * There is exactly one timeline per spec, and the browser and the MP4
 * renderer both read from it. That is why a scroll preview and its exported
 * video can never disagree.
 *
 *   spec ──buildTimeline──▶ { timeline, state, total, sample(t) }
 *
 * `sample(t)` returns a plain-JSON snapshot of the whole stage:
 *   { camera, elements[], copy[], veil, sceneIndex, sceneProgress, tSec }
 */

import gsap from 'gsap';

import { clamp, lerp, mapRange, hash01 } from './util.js';
import { resolveEase } from './easings.js';
import { resolveTheme } from './stylesets.js';

const DEFAULTS = {
  camera: {
    position: [0, 0.6, 6],
    lookAt: [0, 0, 0],
    fov: 42,
    ease: 'power2.inOut',
  },
  copyEnter: [0.1, 0.26],
  copyExit: [0.84, 0.96],
  wordStagger: 0.035, // fraction of the enter window per word
  elementOpacity: { from: 0, to: 1, enter: [0, 0.18], exit: [0.86, 1] },
};

const vecTween = (arr, to) => ({ 0: to[0], 1: to[1], 2: to[2] });

const v3 = (a, fallback) => (Array.isArray(a) && a.length === 3 ? a.map(Number) : fallback);

/** Normalise a camera block, filling from the previous scene for continuity. */
function normaliseCamera(raw, prev) {
  const c = { ...DEFAULTS.camera, ...(raw || {}) };
  const from = raw?.from ? {
    position: v3(raw.from.position, prev.position),
    lookAt: v3(raw.from.lookAt, prev.lookAt),
    fov: raw.from.fov ?? prev.fov,
  } : {
    position: prev.position,
    lookAt: prev.lookAt,
    fov: prev.fov,
  };
  const to = {
    position: v3(raw?.to?.position ?? raw?.position, from.position),
    lookAt: v3(raw?.to?.lookAt ?? raw?.lookAt, from.lookAt),
    fov: raw?.to?.fov ?? raw?.fov ?? from.fov,
  };
  return { from, to, ease: resolveEase(raw?.ease, 'power2.inOut'), shake: Number(raw?.shake ?? 0) };
}

/** Resolve an element's from/to transform into flat, tweenable keys. */
function elementState(el) {
  const s = el.transform || el;
  const base = {
    position: v3(s.from?.position ?? el.position ?? el.at, [0, 0, 0]),
    rotation: v3(s.from?.rotation ?? el.rotation, [0, 0, 0]),
    scale: typeof s.from?.scale === 'number' ? [s.from.scale, s.from.scale, s.from.scale]
      : v3(s.from?.scale ?? el.scale, [1, 1, 1]),
  };
  const target = {
    position: v3(s.to?.position ?? el.to?.position, base.position),
    rotation: v3(s.to?.rotation ?? el.to?.rotation, base.rotation),
    scale: typeof s.to?.scale === 'number' ? [s.to.scale, s.to.scale, s.to.scale]
      : v3(s.to?.scale ?? el.to?.scale, base.scale),
  };
  return { base, target };
}

export function buildTimeline(spec) {
  const theme = resolveTheme(spec);
  const scenes = spec.scenes || [];
  const total = scenes.reduce((n, s) => n + (Number(s.duration) || 4), 0) || 1;

  // ---- running state: the single object the timeline writes into ----------
  // Arrays are created ONCE and mutated in place: GSAP keeps a reference to
  // whatever object it tweens, so replacing an array mid-build silently
  // detaches later tweens. This is the one rule this file must never break.
  const state = {
    camera: {
      position: [0, 0, 0],
      lookAt: [0, 0, 0],
      fov: DEFAULTS.camera.fov,
    },
    veil: 0,             // 0 = clear, 1 = fully covered by veil colour
    bg: theme.palette.bg,
    elements: {},        // id -> { position, rotation, scale, opacity }
    copies: {},          // id -> { opacity, y, words[] }
  };

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const sceneMeta = [];

  let cursor = 0;
  let prevCam = {
    position: [...DEFAULTS.camera.position],
    lookAt: [...DEFAULTS.camera.lookAt],
    fov: DEFAULTS.camera.fov,
  };

  // fromTo (not set+to) so the start value is explicit and cannot be captured
  // stale at build time. immediateRender:false keeps the build side-effect free.
  const fromToVec = (arr, from, to, at, duration, ease) => tl.fromTo(
    arr,
    { ...vecTween(arr, from) },
    { ...vecTween(arr, to), duration, ease, immediateRender: false },
    at,
  );

  scenes.forEach((scene, si) => {
    const dur = Number(scene.duration) || 4;
    const start = cursor;
    const S = (f) => start + Math.min(1, Math.max(0, f)) * dur;
    const cam = normaliseCamera(scene.camera, prevCam);

    // ---- camera: pin the start, then travel ------------------------------
    fromToVec(state.camera.position, cam.from.position, cam.to.position, start, dur, cam.ease);
    fromToVec(state.camera.lookAt, cam.from.lookAt, cam.to.lookAt, start, dur, cam.ease);
    tl.fromTo(state.camera, { fov: cam.from.fov }, { fov: cam.to.fov, duration: dur, ease: cam.ease, immediateRender: false }, start);

    // ---- veil (scene transition) -----------------------------------------
    const tr = scene.transition || 'fade';
    const veilColour = scene.veilColour || theme.palette.bg;
    tl.set(state, { bg: veilColour }, start);
    if (si > 0 && tr !== 'cut') {
      const veilDur = tr === 'dip' ? 0.55 : 0.32;
      tl.set(state, { veil: 1 }, start);
      tl.to(state, { veil: 0, duration: veilDur, ease: 'power2.out' }, start);
    }
    if (tr === 'dip') {
      tl.to(state, { veil: 1, duration: 0.3, ease: 'power2.in' }, S(0.9));
      tl.set(state, { veil: 0 }, Math.min(total, S(1) - 0.001));
    }

    // ---- elements ---------------------------------------------------------
    (scene.elements || []).forEach((el, ei) => {
      const id = el.id || `${scene.id || `s${si}`}-e${ei}`;
      const { base, target } = elementState(el);
      const enter = el.enter ?? DEFAULTS.elementOpacity.enter;
      const exit = el.exit ?? DEFAULTS.elementOpacity.exit;

      // Reusing an id across scenes carries the element forward; the first
      // scene's shape/material wins, later scenes re-pose it.
      let st = state.elements[id];
      if (!st) {
        st = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], opacity: 0 };
        state.elements[id] = st;
      }

      const eEase = resolveEase(el.ease, cam.ease);
      fromToVec(st.position, base.position, target.position, start, dur, eEase);
      fromToVec(st.rotation, base.rotation, target.rotation, start, dur, eEase);
      fromToVec(st.scale, base.scale, target.scale, start, dur, eEase);

      const oIn = el.opacityIn ?? 0;
      const oHold = el.opacity ?? 1;
      tl.fromTo(st, { opacity: oIn }, {
        opacity: oHold,
        duration: Math.max(0.001, (enter[1] - enter[0]) * dur),
        ease: resolveEase(el.opacityEase, 'power2.out'),
        immediateRender: false,
      }, S(enter[0]));
      if (!el.hold) {
        tl.to(st, {
          opacity: el.opacityOut ?? 0,
          duration: Math.max(0.001, (exit[1] - exit[0]) * dur),
          ease: 'power2.in',
        }, S(exit[0]));
      }
    });

    // ---- copy -------------------------------------------------------------
    const copyItems = [];
    (scene.copy || []).forEach((item, ci) => {
      const id = item.id || `${scene.id || `s${si}`}-c${ci}`;
      const enter = item.enter ?? DEFAULTS.copyEnter;
      const exit = item.exit ?? DEFAULTS.copyExit;
      const words = String(item.text ?? '').split(/\s+/).filter(Boolean);

      let st = state.copies[id];
      if (!st) {
        st = { opacity: 0, y: 24, words: words.map(() => 0) };
        state.copies[id] = st;
      }

      tl.fromTo(st, { opacity: 0, y: 26 }, {
        opacity: 1,
        y: 0,
        duration: Math.max(0.001, (enter[1] - enter[0]) * dur * 0.75),
        ease: resolveEase(item.ease, 'expo.out'),
        immediateRender: false,
      }, S(enter[0]));

      const stagger = item.stagger ?? DEFAULTS.wordStagger;
      const span = Math.max(0.001, (enter[1] - enter[0]) * 0.8);
      const per = words.length > 1 ? Math.min(stagger * 0.9, (span * 0.55) / words.length) : 0;
      words.forEach((_, wi) => {
        tl.fromTo(st.words, { [wi]: 0 }, {
          [wi]: 1,
          duration: Math.max(0.001, span * 0.45),
          ease: resolveEase(item.ease, 'expo.out'),
          immediateRender: false,
        }, S(enter[0] + wi * per));
      });

      if (!item.hold) {
        tl.to(st, {
          opacity: 0,
          y: -20,
          duration: Math.max(0.001, (exit[1] - exit[0]) * dur),
          ease: 'power2.in',
        }, S(exit[0]));
      }

      copyItems.push({ id, words, kind: item.kind || 'display', slot: item.slot || 'center-left' });
    });

    sceneMeta.push({
      index: si,
      id: scene.id || `scene-${si}`,
      label: scene.label || scene.id || `Scene ${si + 1}`,
      start,
      duration: dur,
      startFrac: start / total,
      endFrac: (start + dur) / total,
      cam,
      copy: copyItems,
      transition: tr,
    });

    prevCam = { position: [...cam.to.position], lookAt: [...cam.to.lookAt], fov: cam.to.fov };
    cursor += dur;
  });

  tl.set({}, {}, total);

  const api = {
    tl,
    state,
    total,
    theme,
    scenes: sceneMeta,

    /** Deterministic snapshot at story progress t (0..1). */
    sample(t) {
      const t01 = clamp(t, 0, 1);
      const tt = t01 * total;
      // render(t, suppressEvents, force) — force=true so a repeated seek to the
      // same time still re-applies values. GSAP otherwise skips the update and
      // the renderer would draw whatever happened to be in the state object.
      tl.render(tt, true, true);
      const idx = indexAt(tt);
      const sc = sceneMeta[idx];
      return {
        t: tt,
        tSec: tt,
        t01,
        bg: state.bg,
        veil: state.veil,
        camera: {
          position: Array.from(state.camera.position),
          lookAt: Array.from(state.camera.lookAt),
          fov: state.camera.fov,
        },
        elements: state.elements,
        copies: state.copies,
        sceneIndex: idx,
        sceneProgress: sc ? clamp((tt - sc.start) / sc.duration, 0, 1) : 0,
      };
    },

    /** Which scene covers this story progress, and its local progress. */
    sceneAt(t) {
      const tt = clamp(t, 0, 1) * total;
      const idx = indexAt(tt);
      return { meta: sceneMeta[idx], index: idx, local: clamp((tt - sceneMeta[idx].start) / sceneMeta[idx].duration, 0, 1) };
    },
  };

  function indexAt(tt) {
    for (let i = sceneMeta.length - 1; i >= 0; i--) {
      if (tt >= sceneMeta[i].start) return i;
    }
    return 0;
  }

  return api;
}

/**
 * Procedural "idle" motion. Applied on top of the tweened transform, as a
 * function of absolute story time — never a random walk — so scrubbing
 * backwards looks identical to scrubbing forwards.
 */
export function applyIdle(st, el, tSec, seed = 0) {
  const id = el.motion || el.idle;
  if (!id || el.animated === false) return st;
  const s = seed + (el.seed ?? 0);
  const out = {
    position: [...st.position],
    rotation: [...st.rotation],
    scale: [...st.scale],
    opacity: st.opacity,
  };

  if (id.spin) {
    const [sx, sy, sz] = Array.isArray(id.spin) ? id.spin : [0, id.spin, 0];
    out.rotation[0] += sx * tSec;
    out.rotation[1] += sy * tSec;
    out.rotation[2] += sz * tSec;
  }
  if (id.float) {
    const amp = typeof id.float === 'number' ? id.float : (id.float.amp ?? 0.15);
    const speed = typeof id.float === 'number' ? 1 : (id.float.speed ?? 1);
    out.position[1] += Math.sin(tSec * speed * 0.9 + hash01(s) * 6.283) * amp;
  }
  if (id.drift) {
    const amp = typeof id.drift === 'number' ? id.drift : (id.drift.amp ?? 0.2);
    const speed = typeof id.drift === 'number' ? 0.4 : (id.drift.speed ?? 0.4);
    out.position[0] += Math.sin(tSec * speed * 0.7 + hash01(s + 3) * 6.283) * amp;
    out.position[2] += Math.cos(tSec * speed * 0.5 + hash01(s + 7) * 6.283) * amp;
  }
  if (id.orbit) {
    const radius = id.orbit.radius ?? 1;
    const speed = id.orbit.speed ?? 0.25;
    out.position[0] += Math.cos(tSec * speed) * radius;
    out.position[2] += Math.sin(tSec * speed) * radius;
  }
  if (id.pulse) {
    const amp = typeof id.pulse === 'number' ? id.pulse : (id.pulse.amp ?? 0.04);
    const speed = typeof id.pulse === 'number' ? 1.2 : (id.pulse.speed ?? 1.2);
    const k = 1 + Math.sin(tSec * speed + hash01(s + 11) * 6.283) * amp;
    out.scale = out.scale.map((v) => v * k);
  }
  if (id.opacityFlicker) {
    out.opacity *= 0.92 + Math.sin(tSec * 2.1 + hash01(s + 13) * 6.283) * id.opacityFlicker;
  }
  return out;
}

/** Camera shake / handheld texture (deterministic). */
export function cameraShake(camera, amount, tSec) {
  if (!amount) return camera;
  return {
    position: [
      camera.position[0] + Math.sin(tSec * 7.3) * amount * 0.05,
      camera.position[1] + Math.cos(tSec * 5.9) * amount * 0.05,
      camera.position[2] + Math.sin(tSec * 6.7) * amount * 0.03,
    ],
    lookAt: [
      camera.lookAt[0] + Math.sin(tSec * 4.1) * amount * 0.02,
      camera.lookAt[1] + Math.cos(tSec * 3.7) * amount * 0.02,
      camera.lookAt[2],
    ],
    fov: camera.fov + Math.sin(tSec * 2.3) * amount * 0.6,
  };
}

export { mapRange, lerp, hash01, DEFAULTS };
