/*
 * Fermed stylesets — the "constant visual style" layer.
 *
 * A style set is a named bundle of palette, typography, motion feel, geometry
 * language, framing and grain. Workers pick ONE per project and never restyle
 * by hand: consistency is enforced by the styleset, not by taste.
 */

export const STYLESETS = {
  'editorial-noir': {
    label: 'Editorial Noir',
    description: 'High-contrast black, warm off-white type, one amber accent. Calm slow camera. Print-magazine gravity.',
    palette: {
      bg: '#0a0a0b',
      surface: '#141416',
      text: '#f4f1ea',
      muted: '#8f8b84',
      accent: '#e8a33d',
      grid: '#232326',
    },
    fonts: {
      display: '"Editorial Display", "Times New Roman", serif',
      body: '"Editorial Sans", "Helvetica Neue", Arial, sans-serif',
      mono: '"IBM Plex Mono", ui-monospace, monospace',
      weightDisplay: 400,
      tracking: '-0.02em',
    },
    motion: { speed: 1, cameraEase: 'power2.inOut', copyEase: 'expo.out', intensity: 0.7 },
    geometry: { metalness: 0.35, roughness: 0.42, flatShading: false, wireframe: false },
    framing: { letterbox: 0.06, vignette: 0.45, grain: 0.06, copyAlign: 'left' },
  },

  'chrome-bloom': {
    label: 'Chrome Bloom',
    description: 'Mirror-metal forms on a deep violet void. High metalness, bloom-friendly accents. Luxurious, tech-couture.',
    palette: {
      bg: '#07060d',
      surface: '#12101f',
      text: '#f2f0ff',
      muted: '#8b86a8',
      accent: '#8f7bff',
      grid: '#1b1830',
    },
    fonts: {
      display: '"Neue Grotesk Display", "Helvetica Neue", Arial, sans-serif',
      body: '"Neue Grotesk", "Helvetica Neue", Arial, sans-serif',
      mono: '"JetBrains Mono", ui-monospace, monospace',
      weightDisplay: 500,
      tracking: '-0.03em',
    },
    motion: { speed: 0.9, cameraEase: 'sine.inOut', copyEase: 'expo.out', intensity: 0.85 },
    geometry: { metalness: 0.92, roughness: 0.14, flatShading: false, wireframe: false },
    framing: { letterbox: 0.04, vignette: 0.6, grain: 0.04, copyAlign: 'center' },
  },

  'bone-archive': {
    label: 'Bone Archive',
    description: 'Paper-white gallery, ink type, ochre accent. Museum catalogue feel: airy, precise, unhurried.',
    palette: {
      bg: '#f2efe8',
      surface: '#e6e2d8',
      text: '#16150f',
      muted: '#6d6a5f',
      accent: '#9a6b2f',
      grid: '#d6d1c4',
    },
    fonts: {
      display: '"Archive Serif", "Times New Roman", serif',
      body: '"Archive Sans", "Helvetica Neue", Arial, sans-serif',
      mono: '"IBM Plex Mono", ui-monospace, monospace',
      weightDisplay: 400,
      tracking: '-0.01em',
    },
    motion: { speed: 1.1, cameraEase: 'power1.inOut', copyEase: 'power3.out', intensity: 0.5 },
    geometry: { metalness: 0.05, roughness: 0.75, flatShading: false, wireframe: false },
    framing: { letterbox: 0.08, vignette: 0.12, grain: 0.03, copyAlign: 'left' },
  },

  'night-signal': {
    label: 'Night Signal',
    description: 'Near-black with electric cyan wireframes. Data-room precision, scanlines, LED accents. For technical reveals.',
    palette: {
      bg: '#04060a',
      surface: '#0a1119',
      text: '#e8f6ff',
      muted: '#5f7d8c',
      accent: '#38f2c4',
      grid: '#10202b',
    },
    fonts: {
      display: '"Signal Mono", "IBM Plex Mono", ui-monospace, monospace',
      body: '"Signal Sans", "Helvetica Neue", Arial, sans-serif',
      mono: '"IBM Plex Mono", ui-monospace, monospace',
      weightDisplay: 500,
      tracking: '0.01em',
    },
    motion: { speed: 1.15, cameraEase: 'power3.inOut', copyEase: 'power4.out', intensity: 1 },
    geometry: { metalness: 0.6, roughness: 0.25, flatShading: true, wireframe: true },
    framing: { letterbox: 0.05, vignette: 0.5, grain: 0.05, copyAlign: 'left' },
  },

  'solar-clay': {
    label: 'Solar Clay',
    description: 'Terracotta and sand, matte volumes, soft daylight. Warm, human, architectural.',
    palette: {
      bg: '#f6efe7',
      surface: '#e8dccf',
      text: '#2a1c14',
      muted: '#8a6f5e',
      accent: '#c4632f',
      grid: '#e0d2c3',
    },
    fonts: {
      display: '"Solar Serif", "Georgia", serif',
      body: '"Solar Sans", "Helvetica Neue", Arial, sans-serif',
      mono: '"IBM Plex Mono", ui-monospace, monospace',
      weightDisplay: 400,
      tracking: '-0.015em',
    },
    motion: { speed: 0.95, cameraEase: 'sine.inOut', copyEase: 'expo.out', intensity: 0.6 },
    geometry: { metalness: 0.02, roughness: 0.88, flatShading: false, wireframe: false },
    framing: { letterbox: 0.07, vignette: 0.18, grain: 0.05, copyAlign: 'left' },
  },

  'void-mono': {
    label: 'Void Mono',
    description: 'Pure black, white type, zero colour. Brutalist and typographic. Geometry as grey sculpture only.',
    palette: {
      bg: '#000000',
      surface: '#0d0d0d',
      text: '#ffffff',
      muted: '#7a7a7a',
      accent: '#ffffff',
      grid: '#1a1a1a',
    },
    fonts: {
      display: '"Mono Display", "Helvetica Neue", Arial, sans-serif',
      body: '"Mono Display", "Helvetica Neue", Arial, sans-serif',
      mono: '"JetBrains Mono", ui-monospace, monospace',
      weightDisplay: 600,
      tracking: '-0.035em',
    },
    motion: { speed: 1, cameraEase: 'power2.inOut', copyEase: 'power4.out', intensity: 0.8 },
    geometry: { metalness: 0.1, roughness: 0.7, flatShading: true, wireframe: false },
    framing: { letterbox: 0.09, vignette: 0.3, grain: 0.08, copyAlign: 'left' },
  },
};

export const STYLESET_NAMES = Object.keys(STYLESETS);

/**
 * Resolve a spec's style set into a concrete theme object.
 * Precedence: spec.theme (explicit overrides) > styleset > base default.
 */
export function resolveTheme(spec = {}) {
  const name = typeof spec.styleset === 'string' ? spec.styleset : spec.styleset?.name;
  const base = STYLESETS[name] || STYLESETS['editorial-noir'];
  const inline = typeof spec.styleset === 'object' ? spec.styleset : {};
  const override = spec.theme || {};

  const theme = {
    // Report the styleset actually applied, not the one that was asked for —
    // otherwise a typo silently renders the default under a wrong label.
    name: STYLESETS[name] ? name : 'editorial-noir',
    requested: name || 'editorial-noir',
    fellBack: !!name && !STYLESETS[name],
    label: base.label,
    description: base.description,
    palette: { ...base.palette, ...(inline.palette || {}), ...(override.palette || {}) },
    fonts: { ...base.fonts, ...(inline.fonts || {}), ...(override.fonts || {}) },
    motion: { ...base.motion, ...(inline.motion || {}), ...(override.motion || {}) },
    geometry: { ...base.geometry, ...(inline.geometry || {}), ...(override.geometry || {}) },
    framing: { ...base.framing, ...(inline.framing || {}), ...(override.framing || {}) },
  };
  return theme;
}

/** A CSS custom-property block for the theme — used by stage.js. */
export function themeToCSS(theme) {
  const p = theme.palette;
  return `
    --fd-bg: ${p.bg};
    --fd-surface: ${p.surface};
    --fd-text: ${p.text};
    --fd-muted: ${p.muted};
    --fd-accent: ${p.accent};
    --fd-grid: ${p.grid};
    --fd-font-display: ${theme.fonts.display};
    --fd-font-body: ${theme.fonts.body};
    --fd-font-mono: ${theme.fonts.mono};
    --fd-weight-display: ${theme.fonts.weightDisplay};
    --fd-tracking: ${theme.fonts.tracking};
    --fd-vignette: ${theme.framing.vignette};
    --fd-grain: ${theme.framing.grain};
    --fd-align: ${theme.framing.copyAlign};
  `;
}
