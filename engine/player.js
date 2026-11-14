/*
 * Fermed player — the runtime glue.
 *
 * Two modes, one truth:
 *
 *   scroll  (default) : Lenis + ScrollTrigger drive `t`. This is the website.
 *   drive   (parity)   : scroll is bypassed; window.__fermed.seek(t) sets `t`
 *                        directly. This is what the MP4 renderer calls, frame
 *                        by frame, at an exact fps.
 *
 * Because both modes call the same `seek(t)` → `timeline.sample(t)` →
 * stage.render + overlay.update path, a rendered video is frame-identical to
 * the site it came from.
 */

import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { buildTimeline } from './timeline.js';
import { resolveTheme } from './stylesets.js';
import { createStage } from './stage.js';
import { createOverlay } from './overlay.js';
import { clamp } from './util.js';

gsap.registerPlugin(ScrollTrigger);

export async function mountFermed({ spec, root = document.body, mode = 'auto' }) {
  const theme = resolveTheme(spec);
  const timeline = buildTimeline(spec);

  const overlay = createOverlay({ root, spec, theme, timeline });
  const stage = createStage({ canvas: overlay.canvas, theme, spec, pixelRatioCap: spec.render?.pixelRatioCap ?? 2 });

  const params = new URLSearchParams(location.search);
  const renderMode = mode === 'drive'
    || params.get('mode') === 'render'
    || navigator.webdriver === true;

  document.body.dataset.mode = renderMode ? 'render' : 'scroll';
  document.title = spec.meta?.title || 'Fermed';

  // ---- sizing -------------------------------------------------------------
  function fit() {
    const w = overlay.stage.clientWidth || window.innerWidth;
    const h = overlay.stage.clientHeight || window.innerHeight;
    stage.setSize(w, h, renderMode ? 1 : Math.min(window.devicePixelRatio || 1, spec.render?.pixelRatioCap ?? 2));
  }
  fit();
  addEventListener('resize', fit);

  // ---- the single frame function -----------------------------------------
  let current = 0;

  function seek(t) {
    current = clamp(t, 0, 1);
    const sample = timeline.sample(current);
    const { meta } = timeline.sceneAt(current);
    sample.__sceneMeta = meta;
    stage.render(sample);
    overlay.update(sample, { interactiveHud: !renderMode });
    return sample;
  }

  // ---- mode: drive (headless / scrubbed) ---------------------------------
  if (renderMode) {
    overlay.hideChrome();
    seek(Number(params.get('t') ?? 0));
    window.__fermed = {
      ready: true,
      mode: 'render',
      t: 0,
      scenes: timeline.scenes,
      duration: timeline.total,
      durationSec: timeline.total,
      styleset: theme.name,
      seek,
      seekSeconds: (s) => seek(s / timeline.total),
      get t01() { return current; },
      sample: (t) => timeline.sample(t),
      theme,
      spec,
    };
    return { timeline, stage, overlay, seek, theme, renderMode: true };
  }

  // ---- mode: scroll (the actual website) ---------------------------------
  const secondsToPx = spec.scroll?.pxPerSecond ?? 180;
  const spacer = document.createElement('div');
  spacer.id = 'fermed-scroll-space';
  const totalPx = Math.max(window.innerHeight * 2, timeline.total * secondsToPx);
  spacer.style.cssText = `position:relative;width:100%;height:${Math.round(totalPx)}px;pointer-events:none`;
  // Fixed stage: the document scrolls behind it, the stage stays put.
  overlay.stage.style.position = 'fixed';
  overlay.stage.style.inset = '0';
  document.body.append(spacer);

  const lenis = new Lenis({
    duration: spec.scroll?.lerpDuration ?? 1.1,
    smoothWheel: spec.scroll?.smooth !== false,
    wheelMultiplier: spec.scroll?.wheelMultiplier ?? 1,
    touchMultiplier: spec.scroll?.touchMultiplier ?? 1.6,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => seek(self.progress),
  });

  // mouse parallax — tiny, style-consistent, never part of the render path
  let px = 0; let py = 0; let tx = 0; let ty = 0;
  addEventListener('pointermove', (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // idle-aware render loop: skip frames when nothing moved
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastT = -1;
  function loop() {
    px += (tx - px) * 0.045;
    py += (ty - py) * 0.045;
    if (Math.abs(px) + Math.abs(py) > 0.001 || current !== lastT) {
      const sample = seek(current);
      if (!reduced) {
        const cam = stage.camera;
        cam.position.x += px * 0.12;
        cam.position.y += -py * 0.08;
        cam.lookAt(...sample.camera.lookAt);
        stage.renderer.render(stage.scene, cam);
      }
      lastT = current;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // chrome auto-hides so the experience stays clean
  let hideTimer;
  addEventListener('pointermove', () => {
    overlay.showChrome();
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => overlay.hideChrome(), 1800);
  }, { passive: true });
  hideTimer = setTimeout(() => overlay.hideChrome(), 2200);

  window.__fermed = {
    ready: true,
    mode: 'scroll',
    timeline,
    seek,
    duration: timeline.total,
    scenes: timeline.scenes,
    scrollTo: (t) => lenis.scrollTo(t * (totalPx - window.innerHeight)),
    theme,
    spec,
  };

  seek(0);
  return { timeline, stage, overlay, seek, theme, lenis, renderMode: false };
}
