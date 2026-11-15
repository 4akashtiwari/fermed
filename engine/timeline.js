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

import { clamp, lerp, mapRange, hash01 } from './util.js';
import { Channel, easeFn } from './tracks.js';
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

/*
 * Vectors are tweenable objects, not arrays.
 *
 * GSAP treats an array argument as a LIST OF TARGETS, so `to([0,0,0], {0: 1})`
 * animates three number targets and creates zero property tweens — the tween
 * "runs" but writes nothing, which is invisible until you scrub backwards and
 * discover the values were never being driven at all. An array-like object
 * ({0,1,2}) is a single target with numeric properties, which is what we want.
 * `Array.from()` still turns it into a plain vector for sampling.
 */
const vec = (x = 0, y = 0, z = 0) => ({ 0: x, 1: y, 2: z });
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

  // Every animated number lives in a Channel. Sampling is pure evaluation —
  // there is no playhead, so seeking backwards costs nothing and cannot drift.
  const channels = new Map();
  const chan = (key, initial = 0) => {
    let c = channels.get(key);
    if (!c) {
      c = new Channel(key).from(initial);
      channels.set(key, c);
    }
    return c;
  };

  const sceneMeta = [];
  let cursor = 0;
  let prevCam = {
    position: [...DEFAULTS.camera.position],
    lookAt: [...DEFAULTS.camera.lookAt],
    fov: DEFAULTS.camera.fov,
  };

  scenes.forEach((scene, si) => {
    const dur = Number(scene.duration) || 4;
    const start = cursor;
    const S = (f) => start + Math.min(1, Math.max(0, f)) * dur;
    const cam = normaliseCamera(scene.camera, prevCam);

    // ---- camera ----------------------------------------------------------
    chan('bg', theme.palette.bg);
    chan('veil', 0);
    for (let i = 0; i < 3; i++) {
      chan(`camera.position.${i}`, prevCam.position[i]).tween(cam.from.position[i], cam.to.position[i], start, dur, cam.ease);
      chan(`camera.lookAt.${i}`, prevCam.lookAt[i]).tween(cam.from.lookAt[i], cam.to.lookAt[i], start, dur, cam.ease);
    }
    chan('camera.fov', prevCam.fov).tween(cam.from.fov, cam.to.fov, start, dur, cam.ease);

    // ---- veil (scene transition) ----------------------------------------
    const tr = scene.transition || 'fade';
    chan('bg').tween(theme.palette.bg, scene.veilColour || theme.palette.bg, start, 0.001, 'none');
    if (si > 0 && tr !== 'cut') {
      const veilDur = tr === 'dip' ? 0.55 : 0.32;
      chan('veil')
        .tween(1, 1, Math.max(0, start - 0.001), 0.001, 'none')
        .tween(1, 0, start, veilDur, 'power2.out');
    }
    if (tr === 'dip') {
      chan('veil')
        .tween(0, 1, S(0.9), Math.min(0.3, dur * 0.1), 'power2.in')
        .tween(1, 0, Math.min(total - 0.002, S(1) - 0.002), 0.001, 'none');
    }

    // ---- elements --------------------------------------------------------
    (scene.elements || []).forEach((el, ei) => {
      const id = el.id || `${scene.id || `s${si}`}-e${ei}`;
      const { base, target } = elementState(el);
      const enter = el.enter ?? DEFAULTS.elementOpacity.enter;
      const exit = el.exit ?? DEFAULTS.elementOpacity.exit;
      const eEase = resolveEase(el.ease, cam.ease);

      for (let i = 0; i < 3; i++) {
        chan(`el.${id}.position.${i}`, base.position[i]).tween(base.position[i], target.position[i], start, dur, eEase);
        chan(`el.${id}.rotation.${i}`, base.rotation[i]).tween(base.rotation[i], target.rotation[i], start, dur, eEase);
        chan(`el.${id}.scale.${i}`, base.scale[i]).tween(base.scale[i], target.scale[i], start, dur, eEase);
      }

      const oIn = el.opacityIn ?? 0;
      const oHold = el.opacity ?? 1;
      chan(`el.${id}.opacity`, oIn)
        .tween(oIn, oHold, S(enter[0]), Math.max(0.001, (enter[1] - enter[0]) * dur), resolveEase(el.opacityEase, 'power2.out'));
      if (!el.hold) {
        chan(`el.${id}.opacity`)
          .tween(oHold, el.opacityOut ?? 0, S(exit[0]), Math.max(0.001, (exit[1] - exit[0]) * dur), 'power2.in');
      }
    });

    // ---- copy ------------------------------------------------------------
    const copyItems = [];
    (scene.copy || []).forEach((item, ci) => {
      const id = item.id || `${scene.id || `s${si}`}-c${ci}`;
      const enter = item.enter ?? DEFAULTS.copyEnter;
      const exit = item.exit ?? DEFAULTS.copyExit;
      const words = String(item.text ?? '').split(/\s+/).filter(Boolean);
      const ease = resolveEase(item.ease, 'expo.out');

      chan(`copy.${id}.opacity`, 0).tween(0, 1, S(enter[0]), Math.max(0.001, (enter[1] - enter[0]) * dur * 0.75), ease);
      chan(`copy.${id}.y`, 26).tween(26, 0, S(enter[0]), Math.max(0.001, (enter[1] - enter[0]) * dur * 0.75), ease);

      const stagger = item.stagger ?? DEFAULTS.wordStagger;
      const span = Math.max(0.001, (enter[1] - enter[0]) * 0.8);
      const per = words.length > 1 ? Math.min(stagger * 0.9, (span * 0.55) / words.length) : 0;
      words.forEach((_, wi) => {
        chan(`copy.${id}.w${wi}`, 0).tween(0, 1, S(enter[0] + wi * per), Math.max(0.001, span * 0.45), ease);
      });

      if (!item.hold) {
        chan(`copy.${id}.opacity`).tween(1, 0, S(exit[0]), Math.max(0.001, (exit[1] - exit[0]) * dur), 'power2.in');
        chan(`copy.${id}.y`).tween(0, -20, S(exit[0]), Math.max(0.001, (exit[1] - exit[0]) * dur), 'power2.in');
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

  const elementIds = [...new Set(scenes.flatMap((s, si) => (s.elements || []).map((el, ei) => el.id || `${s.id || `s${si}`}-e${ei}`)))];
  const copyIds = [...new Set(scenes.flatMap((s, si) => {
    const out = [];
    (s.copy || []).forEach((item, ci) => out.push(item.id || `${s.id || `s${si}`}-c${ci}`));
    return out;
  }))];

  // word counts, so sampling knows how many word channels to read
  const wordCounts = {};
  scenes.forEach((s, si) => {
    (s.copy || []).forEach((item, ci) => {
      const id = item.id || `${s.id || `s${si}`}-c${ci}`;
      wordCounts[id] = String(item.text ?? '').split(/\s+/).filter(Boolean).length;
    });
  });

  const api = {
    total,
    theme,
    scenes: sceneMeta,
    channels,

    /** Deterministic snapshot at story progress t (0..1). Always plain JSON. */
    sample(t) {
      const t01 = clamp(t, 0, 1);
      const tt = t01 * total;
      const idx = indexAt(tt);
      const sc = sceneMeta[idx];

      const camera = {
        position: [chan('camera.position.0').at(tt), chan('camera.position.1').at(tt), chan('camera.position.2').at(tt)],
        lookAt: [chan('camera.lookAt.0').at(tt), chan('camera.lookAt.1').at(tt), chan('camera.lookAt.2').at(tt)],
        fov: chan('camera.fov').at(tt),
      };

      const elements = {};
      for (const id of elementIds) {
        elements[id] = {
          position: [chan(`el.${id}.position.0`).at(tt), chan(`el.${id}.position.1`).at(tt), chan(`el.${id}.position.2`).at(tt)],
          rotation: [chan(`el.${id}.rotation.0`).at(tt), chan(`el.${id}.rotation.1`).at(tt), chan(`el.${id}.rotation.2`).at(tt)],
          scale: [chan(`el.${id}.scale.0`).at(tt), chan(`el.${id}.scale.1`).at(tt), chan(`el.${id}.scale.2`).at(tt)],
          opacity: chan(`el.${id}.opacity`).at(tt),
        };
      }

      const copies = {};
      for (const id of copyIds) {
        const words = [];
        for (let wi = 0; wi < (wordCounts[id] || 0); wi++) words.push(chan(`copy.${id}.w${wi}`).at(tt));
        copies[id] = {
          opacity: chan(`copy.${id}.opacity`).at(tt),
          y: chan(`copy.${id}.y`).at(tt),
          words,
        };
      }

      return {
        t: tt,
        tSec: tt,
        t01,
        bg: chan('bg').at(tt),
        veil: clamp(chan('veil').at(tt), 0, 1),
        camera,
        elements,
        copies,
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
