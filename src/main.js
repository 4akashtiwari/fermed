/*
 * Fermed boot file.
 *
 * Loads a spec (URL param `spec`, default ./specs/demo.json), validates it,
 * then hands it to the engine. Nothing else happens here — all behaviour lives
 * in /engine so the CLI can import the exact same code.
 */

import { mountFermed } from '../engine/player.js';
import { validateSpec } from '../engine/schema.js';
import { resolveTheme } from '../engine/stylesets.js';

const params = new URLSearchParams(location.search);
const specUrl = params.get('spec') || './specs/demo.json';

function fail(message) {
  const el = document.getElementById('fermed-fallback');
  if (el) {
    el.hidden = false;
    document.getElementById('fermed-error').textContent = message;
  }
  console.error('[fermed]', message);
}

/** Minimal styleset JSON loader: `?sheet=chrome-bloom` for a quick look. */
async function loadSpec(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`spec not found: ${url} (HTTP ${res.status})`);
  return res.json();
}

(async function boot() {
  try {
    const raw = await loadSpec(specUrl);
    const { ok, errors, spec } = validateSpec(raw);
    if (!ok) {
      const list = errors.slice(0, 8).map((e) => `· ${e.path}: ${e.message}`).join('\n');
      fail(`Spec is invalid:\n${list}${errors.length > 8 ? `\n…and ${errors.length - 8} more` : ''}`);
      window.__fermedError = errors;
      return;
    }

    document.title = spec.meta.title;
    const meta = document.createElement('meta');
    meta.name = 'generator';
    meta.content = `Fermed · styleset:${resolveTheme(spec).name}`;
    document.head.append(meta);

    await mountFermed({ spec, root: document.body });
  } catch (err) {
    fail(String(err?.message || err));
    window.__fermedError = [String(err?.stack || err)];
  }
})();
