/*
 * Fermed overlay — the "PowerPoint" layer.
 *
 * Copy, framing chrome and the film grain live in DOM, not WebGL, so type
 * stays razor-sharp at any resolution and the 3D scene stays cheap. The
 * overlay is a pure function of the timeline sample, same as the stage.
 */

import { esc, clamp } from './util.js';
import { themeToCSS } from './stylesets.js';

const SLOTS = {
  'top-left': 'align-items:flex-start;justify-content:flex-start;text-align:left',
  'top-center': 'align-items:flex-start;justify-content:center;text-align:center',
  'top-right': 'align-items:flex-start;justify-content:flex-end;text-align:right',
  'center-left': 'align-items:center;justify-content:flex-start;text-align:left',
  'center': 'align-items:center;justify-content:center;text-align:center',
  'center-right': 'align-items:center;justify-content:flex-end;text-align:right',
  'bottom-left': 'align-items:flex-end;justify-content:flex-start;text-align:left',
  'bottom-center': 'align-items:flex-end;justify-content:center;text-align:center',
  'bottom-right': 'align-items:flex-end;justify-content:flex-end;text-align:right',
};

const CSS = `
  #fermed-stage{position:absolute;inset:0;overflow:hidden;background:var(--fd-bg);
    font-family:var(--fd-font-body);color:var(--fd-text);}
  #fermed-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  #fermed-overlay{position:absolute;inset:0;pointer-events:none}
  .fd-slot{position:absolute;inset:0;display:flex;padding:clamp(28px,6vw,110px);
    pointer-events:none}
  .fd-slot > div{max-width:min(1120px,88%);display:flex;flex-direction:column;
    gap:.55em;align-items:inherit}
  .fd-copy{opacity:0;will-change:opacity,transform}
  .fd-eyebrow{font-family:var(--fd-font-mono);font-size:clamp(10px,1.05vw,14px);
    letter-spacing:.28em;text-transform:uppercase;color:var(--fd-accent);opacity:.9}
  .fd-display{font-family:var(--fd-font-display);font-weight:var(--fd-weight-display);
    letter-spacing:var(--fd-tracking);font-size:clamp(30px,5.4vw,84px);line-height:1.02;
    margin:0;text-wrap:balance}
  .fd-lead{font-size:clamp(13px,1.35vw,21px);line-height:1.55;color:var(--fd-muted);
    max-width:52ch;margin:0}
  .fd-metric{font-family:var(--fd-font-display);font-size:clamp(44px,9vw,150px);
    line-height:.9;letter-spacing:var(--fd-tracking);margin:0;
    font-variant-numeric:tabular-nums}
  .fd-word{display:inline-block;will-change:opacity,transform}
  .fd-rule{width:64px;height:1px;background:var(--fd-accent);opacity:.7}
  .fd-caption{position:absolute;left:clamp(28px,6vw,110px);bottom:clamp(28px,5vw,86px);
    font-family:var(--fd-font-mono);font-size:clamp(9px,1vw,12px);letter-spacing:.22em;
    text-transform:uppercase;color:var(--fd-muted);opacity:.75}
  /* --- framing chrome ------------------------------------------------- */
  .fd-letterbox{position:absolute;left:0;right:0;height:0;background:#000;z-index:5}
  .fd-vignette{position:absolute;inset:0;z-index:4;pointer-events:none;
    background:radial-gradient(120% 90% at 50% 45%,transparent 40%,rgba(0,0,0,.92) 100%);
    opacity:var(--fd-vignette)}
  .fd-grain{position:absolute;inset:-50%;z-index:6;pointer-events:none;opacity:var(--fd-grain);
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.55'/></svg>");
    animation:fd-grain-shift .6s steps(3) infinite}
  @keyframes fd-grain-shift{
    0%{transform:translate(0,0)}33%{transform:translate(-2%,1.5%)}66%{transform:translate(1.5%,-2%)}100%{transform:translate(0,0)}
  }
  .fd-veil{position:absolute;inset:0;z-index:7;background:var(--fd-veil-color,#000);opacity:0}
  /* --- progress chrome (preview only) --------------------------------- */
  .fd-chrome{position:absolute;z-index:8;font-family:var(--fd-font-mono);
    font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--fd-muted);
    pointer-events:none;transition:opacity .3s ease}
  .fd-chrome[data-fade="1"]{opacity:0}
  #fd-progress{position:absolute;left:0;right:0;bottom:0;height:2px;z-index:9;
    background:rgba(255,255,255,.08)}
  #fd-progress > i{display:block;height:100%;width:0;background:var(--fd-accent);opacity:.9}
  #fd-hud{right:clamp(18px,3vw,40px);bottom:clamp(16px,3vw,34px)}
  #fd-chapters{left:clamp(18px,3vw,40px);bottom:clamp(16px,3vw,34px);display:flex;gap:6px;
    align-items:center}
  .fd-chip{width:26px;height:2px;background:rgba(255,255,255,.16)}
  .fd-chip[data-on="1"]{background:var(--fd-accent)}
  body[data-mode="render"] .fd-chrome,
  body[data-mode="render"] #fd-progress,
  body[data-mode="render"] .fd-grain{display:none}
  @media (prefers-reduced-motion: reduce){ .fd-grain{animation:none} }
`;

export function createOverlay({ root, spec, theme, timeline }) {
  // ---- build DOM ----------------------------------------------------------
  const stage = document.createElement('div');
  stage.id = 'fermed-stage';

  const canvas = document.createElement('canvas');
  canvas.id = 'fermed-canvas';

  const overlay = document.createElement('div');
  overlay.id = 'fermed-overlay';

  const style = document.createElement('style');
  style.textContent = CSS + `#fermed-stage{${themeToCSS(theme)}}`;

  const vignette = document.createElement('div');
  vignette.className = 'fd-vignette';
  const letterTop = document.createElement('div');
  letterTop.className = 'fd-letterbox';
  letterTop.style.top = '0';
  const letterBottom = document.createElement('div');
  letterBottom.className = 'fd-letterbox';
  letterBottom.style.bottom = '0';
  const grain = document.createElement('div');
  grain.className = 'fd-grain';
  const veil = document.createElement('div');
  veil.className = 'fd-veil';
  const progress = document.createElement('div');
  progress.id = 'fd-progress';
  progress.innerHTML = '<i></i>';
  const hud = document.createElement('div');
  hud.className = 'fd-chrome';
  hud.id = 'fd-hud';
  const chapters = document.createElement('div');
  chapters.className = 'fd-chrome';
  chapters.id = 'fd-chapters';
  chapters.innerHTML = (spec.scenes || [])
    .map((s) => `<span class="fd-chip" title="${esc(s.label || s.id || '')}"></span>`)
    .join('');

  stage.append(canvas, overlay, vignette, letterTop, letterBottom, grain, veil, hud, chapters, progress);
  root.append(style, stage);

  const lb = theme.framing.letterbox;
  if (lb > 0) {
    letterTop.style.height = `${lb * 100}%`;
    letterBottom.style.height = `${lb * 100}%`;
  } else {
    letterTop.style.display = 'none';
    letterBottom.style.display = 'none';
  }

  // ---- copy blocks --------------------------------------------------------
  // Items are grouped per (scene, slot) so a scene can put an eyebrow, a
  // headline and a lead in the same corner and they stack as one column
  // instead of three absolutely-positioned layers fighting for the same pixels.
  const copyEls = new Map(); // itemId -> { el, words[], slotWrap, item }
  const slotWraps = new Map(); // `${sceneIdx}:${slot}` -> element

  (spec.scenes || []).forEach((sceneDef, si) => {
    for (const item of sceneDef.copy || []) {
      const id = item.id || `${sceneDef.id}-${copyEls.size}`;
      const slot = item.slot || 'center-left';

      let wrap = slotWraps.get(`${si}:${slot}`);
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'fd-slot';
        wrap.style.cssText = SLOTS[slot] || SLOTS['center-left'];
        const col = document.createElement('div');
        wrap.append(col);
        wrap._col = col;
        overlay.append(wrap);
        slotWraps.set(`${si}:${slot}`, wrap);
      }

      const el = document.createElement('div');
      el.className = 'fd-copy';
      el.dataset.id = id;

      const kind = item.kind || 'display';
      if (item.eyebrow) {
        const e = document.createElement('div');
        e.className = 'fd-eyebrow';
        e.textContent = item.eyebrow;
        el.append(e);
      }
      if (item.rule) {
        const r = document.createElement('div');
        r.className = 'fd-rule';
        el.append(r);
      }

      const tag = kind === 'metric' ? 'div' : kind === 'lead' ? 'p' : kind === 'eyebrow' ? 'div' : 'h2';
      const node = document.createElement(tag);
      node.className = kind === 'metric' ? 'fd-metric'
        : kind === 'lead' ? 'fd-lead'
          : kind === 'eyebrow' ? 'fd-eyebrow'
            : 'fd-display';

      const wordsHost = document.createElement('span');
      wordsHost.className = 'fd-words';
      node.append(wordsHost);
      if (kind === 'metric' && item.suffix) {
        const suf = document.createElement('span');
        suf.textContent = item.suffix;
        suf.style.cssText = 'font-size:.42em;color:var(--fd-accent);margin-left:.12em';
        node.append(suf);
      }

      const words = String(item.text ?? '').split(/\s+/).filter(Boolean);
      const spans = words.map((w, i) => {
        const span = document.createElement('span');
        span.className = 'fd-word';
        span.textContent = w;
        span.style.opacity = '0';
        span.style.transform = 'translateY(0.35em)';
        wordsHost.append(span);
        if (i < words.length - 1) wordsHost.append(document.createTextNode(' '));
        return span;
      });

      el.append(node);
      if (item.caption) {
        const c = document.createElement('div');
        c.className = 'fd-caption';
        c.style.cssText = 'position:static;padding-top:1em';
        c.textContent = item.caption;
        el.append(c);
      }
      wrap._col.append(el);
      copyEls.set(id, { el, words: spans, item, slotWrap: wrap });
    }
  });

  // ---- per-frame update (pure function of sample) -------------------------
  let lastSceneIndex = -1;

  function update(sample, { interactiveHud = true } = {}) {
    veil.style.opacity = String(clamp(sample.veil, 0, 1));
    veil.style.setProperty('--fd-veil-color', sample.bg || theme.palette.bg);

    for (const [id, entry] of copyEls) {
      const st = sample.copies[id];
      if (!st) {
        entry.el.style.opacity = '0';
        entry.el.style.visibility = 'hidden';
        continue;
      }
      const visible = st.opacity > 0.004;
      entry.el.style.visibility = visible ? 'visible' : 'hidden';
      entry.el.style.opacity = st.opacity.toFixed(3);
      entry.el.style.transform = `translateY(${st.y.toFixed(2)}px)`;
      entry.words.forEach((w, i) => {
        const p = st.words[i] ?? 0;
        w.style.opacity = p.toFixed(3);
        w.style.transform = `translateY(${((1 - p) * 0.35).toFixed(3)}em)`;
      });
    }

    if (interactiveHud) {
      const pct = sample.t01 * 100;
      progress.firstChild.style.width = `${pct.toFixed(2)}%`;
      hud.textContent = `${String(sample.sceneIndex + 1).padStart(2, '0')} / ${String((spec.scenes || []).length).padStart(2, '0')}  ·  ${(sample.tSec).toFixed(1)}s`;
      if (sample.sceneIndex !== lastSceneIndex) {
        [...chapters.children].forEach((c, i) => c.dataset.on = i === sample.sceneIndex ? '1' : '0');
        lastSceneIndex = sample.sceneIndex;
      }
    }
  }

  function hideChrome() {
    hud.dataset.fade = '1';
    chapters.dataset.fade = '1';
  }
  function showChrome() {
    hud.dataset.fade = '0';
    chapters.dataset.fade = '0';
  }

  return { stage, canvas, overlay, update, hideChrome, showChrome, chunks: copyEls };
}
