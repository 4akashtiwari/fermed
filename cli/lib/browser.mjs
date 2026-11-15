/*
 * Shared browser plumbing for the CLI.
 *
 * Both `render` and `check:layout` need the same thing: a Chromium with
 * software WebGL, pointed at a built site, with the engine ready. Keeping it
 * here means the two commands can never disagree about launch flags — which is
 * how "the check passed but the render looked wrong" happens.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

/** Chromium needs software GL, no sandbox, deterministic colour + no scrollbars. */
export const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--force-color-profile=srgb',
  '--hide-scrollbars',
  '--disable-lcd-text',
  '--font-render-hinting=none',
  '--disable-background-timer-throttling',
];

/** Launch a browser, or explain precisely what to install if it will not start. */
export async function launchBrowser() {
  const { chromium } = await import('playwright');
  try {
    return await chromium.launch({ args: CHROMIUM_ARGS });
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes('libnspr4') || msg.includes('cannot open shared object file')) {
      throw new Error(
        'Chromium is missing system libraries. On Debian/Ubuntu:\n'
        + '  sudo apt-get install -y libnspr4 libnss3 libgbm1 libasound2t64 libatk1.0-0 \\\n'
        + '    libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \\\n'
        + '    libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 libatspi2.0-0\n'
        + 'On macOS/Windows no extra packages are needed; run `npx playwright install chromium`.',
      );
    }
    if (msg.includes('Executable doesn')) {
      throw new Error('Chromium is not downloaded. Run: npx playwright install chromium');
    }
    throw err;
  }
}

/**
 * Best-effort DNS + TCP connectivity check. Never throws.
 * Used by `fermed doctor` so an offline machine gives one clear line instead of
 * a stack trace from deep inside Playwright.
 */
export async function checkNetwork(host = 'registry.npmjs.org') {
  const dns = await import('node:dns/promises');
  const net = await import('node:net');
  try {
    await dns.lookup(host);
  } catch {
    return { ok: false, detail: `cannot resolve ${host}` };
  }
  return new Promise((resolve) => {
    const sock = net.connect({ host, port: 443, timeout: 4000 });
    sock.on('connect', () => { sock.destroy(); resolve({ ok: true, detail: `${host}:443 reachable` }); });
    sock.on('timeout', () => { sock.destroy(); resolve({ ok: false, detail: `${host}:443 timed out` }); });
    sock.on('error', (e) => { sock.destroy(); resolve({ ok: false, detail: `${host}:443 ${e.code || e.message}` }); });
  });
}

/**
 * Start a static server over `dir`. Used when a spec needs rendering without a
 * dev server, and by the layout checker.
 */
export async function serveStatic(dir, port = 0) {
  const http = await import('node:http');
  const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
  };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(dir, url === '/' ? 'index.html' : url);
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const { port: actual } = server.address();
  return {
    url: `http://127.0.0.1:${actual}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

/**
 * Build the site into dist/ (idempotent-ish: skip if dist is newer than the
 * inputs). Returns a static server bound to that build.
 */
export async function buildAndServe({ force = false } = {}) {
  const dist = path.join(ROOT, 'dist');
  const inputs = ['engine', 'src', 'index.html', 'vite.config.js', 'specs', 'tests/fixtures'];
  const newest = (dir) => {
    let t = 0;
    const walk = (p) => {
      const st = fs.statSync(p);
      if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f));
      else t = Math.max(t, st.mtimeMs);
    };
    const full = path.join(ROOT, dir);
    if (fs.existsSync(full)) walk(full);
    return t;
  };
  const distTime = fs.existsSync(path.join(dist, 'index.html')) ? fs.statSync(path.join(dist, 'index.html')).mtimeMs : 0;
  const srcTime = Math.max(...inputs.map((i) => newest(i)));

  if (force || !distTime || distTime < srcTime) {
    const { build } = await import('vite');
    await build({
      root: ROOT,
      configFile: path.join(ROOT, 'vite.config.js'),
      logLevel: 'error',
    });
  }
  return serveStatic(dist);
}

/** Open the built site in render mode and wait for the engine to be ready. */
export async function openRenderPage(browser, baseUrl, specRelPath, viewport) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  const url = `${baseUrl}/index.html?spec=${encodeURIComponent(specRelPath)}&mode=render`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
  try {
    await page.waitForFunction(() => window.__fermed?.ready === true, { timeout: 60_000 });
  } catch {
    // The engine never mounted — the useful information is the spec validation
    // error or the page exception, not the timeout.
    const detail = await page.evaluate(() => ({
      invalid: window.__fermedError || null,
      fallback: document.getElementById('fermed-error')?.textContent || null,
    })).catch(() => ({}));
    const reason = detail.invalid
      ? JSON.stringify(detail.invalid.slice?.(0, 5) ?? detail.invalid)
      : detail.fallback || errors.slice(0, 3).join(' | ') || 'engine did not report ready';
    throw new Error(`engine failed to start for ${specRelPath}: ${reason}`);
  }
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(120);
  return { page, errors, url };
}
